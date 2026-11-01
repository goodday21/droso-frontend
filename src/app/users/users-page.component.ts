import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map, switchMap, tap } from 'rxjs';
import { failureMessage } from '../api/api-error';
import { shortenEmail } from '../header/shorten-email';
import { PageBarComponent } from '../layout/page-bar.component';
import { UserPage } from './users.model';
import { UsersApiService } from './users-api.service';
import { PAGE_SIZES, UsersQuery, parseUsersQuery } from './users-query';

/** A row of the table: the email cut as in the header, the full one as its hint when cut. */
interface UserRow {
  id: number;
  email: string;
  fullEmail: string | null;
  role: string;
}

const FAILURE_MESSAGES = { FORBIDDEN: 'You do not have permission to manage users.' };

/**
 * The list of the users, a page at a time (`GET /api/v1/users`); for the administrators, who have
 * the permission `USER_MANAGE`. Anyone else who opens it gets the 403 of the backend as a message.
 *
 * The page and its size are in the query of the URL (`?page=2&size=100`, the page counted from 1),
 * so that a reload and a link keep them; a change replaces the entry of the history rather than
 * adding one, so that *Back* leaves the list.
 *
 * The table is as high as its rows, up to the bottom of the window: then it scrolls inside its box,
 * under a fixed head, while the pager below stays in view. While the next page loads, the rows of
 * the previous one stay, so that the table does not jump.
 */
@Component({
  selector: 'app-users-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageBarComponent],
  // `fills-window`: see `styles.css`, the page takes the rest of the window.
  host: { class: 'fills-window' },
  template: `
    <app-page-bar title="Users" />

    <section class="card" [attr.aria-busy]="loading()">
      @if (error(); as message) {
        <p class="alert alert--error" role="alert">{{ message }}</p>
      } @else if (rows() === null) {
        <p class="note">Loading…</p>
      } @else {
        <div class="scroll" tabindex="0" aria-label="Users">
          <table>
            <thead>
              <tr>
                <th scope="col" class="id">ID</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr>
                  <td class="id">{{ row.id }}</td>
                  <td class="email" [attr.title]="row.fullEmail">{{ row.email }}</td>
                  <td>{{ row.role }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="note">{{ total() === 0 ? 'No users.' : 'No users on this page.' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (!error()) {
        <nav class="pager" aria-label="Pages of the list">
          <button
            type="button"
            (click)="open(1)"
            [disabled]="query().page <= 1"
            aria-label="First page"
            title="First page"
          >
            «
          </button>
          <button
            type="button"
            (click)="open(query().page - 1)"
            [disabled]="query().page <= 1"
            aria-label="Previous page"
            title="Previous page"
          >
            ‹
          </button>
          <span class="position">Page {{ query().page }} of {{ pages() }}</span>
          <button
            type="button"
            (click)="open(query().page + 1)"
            [disabled]="query().page >= pages()"
            aria-label="Next page"
            title="Next page"
          >
            ›
          </button>
          <button
            type="button"
            (click)="open(pages())"
            [disabled]="query().page >= pages()"
            aria-label="Last page"
            title="Last page"
          >
            »
          </button>
          <span class="total">Total: {{ total() ?? '…' }}</span>
          <label class="size">
            Rows per page
            <select [value]="query().size" (change)="resize($event)">
              @for (size of sizes; track size) {
                <option [value]="size" [selected]="size === query().size">{{ size }}</option>
              }
            </select>
          </label>
        </nav>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-height: 0;
        background: #fff;
        border-radius: 8px;
        padding: 1.25rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      }
      /* As high as the rows, up to the rest of the window; then the rows scroll under the head. */
      .scroll {
        flex: 0 1 auto;
        min-height: 0;
        overflow: auto;
        border: 1px solid #e4e7eb;
        border-radius: 6px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        padding: 0.375rem 0.75rem;
        text-align: left;
        border-bottom: 1px solid #e4e7eb;
        white-space: nowrap;
      }
      /* A line of its own: the border of a sticky cell stays behind in a collapsed table. */
      thead th {
        position: sticky;
        top: 0;
        border-bottom: none;
        box-shadow: inset 0 -1px #e4e7eb;
        background: #f5f7fa;
        color: #52606d;
        font-weight: 600;
      }
      .id {
        width: 1%;
        text-align: right;
      }
      .note {
        margin: 0;
        color: #52606d;
      }
      .pager {
        display: flex;
        flex: none;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
      }
      .position {
        padding: 0 0.25rem;
        white-space: nowrap;
      }
      .total {
        padding-left: 0.5rem;
        color: #52606d;
        white-space: nowrap;
      }
      .size {
        margin-left: auto;
      }
      .size {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        white-space: nowrap;
      }
      button,
      select {
        font: inherit;
      }
      button {
        min-width: 2rem;
        padding: 0.25rem 0.5rem;
      }
      .alert {
        margin: 0;
        padding: 0.625rem 0.75rem;
        border-radius: 6px;
      }
      .alert--error {
        background: #fff5f5;
        color: #c92a2a;
      }
    `,
  ],
})
export class UsersPageComponent {
  private readonly api = inject(UsersApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly sizes = PAGE_SIZES;

  readonly query = toSignal(this.route.queryParamMap.pipe(map(parseUsersQuery)), { requireSync: true });

  /** The last page that the backend answered; kept while the next one loads. */
  private readonly loaded = signal<UserPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly rows = computed<UserRow[] | null>(
    () =>
      this.loaded()?.items.map((user) => {
        const email = shortenEmail(user.email);
        return { id: user.id, email, fullEmail: email === user.email ? null : user.email, role: user.role };
      }) ?? null,
  );

  readonly total = computed(() => this.loaded()?.totalElements ?? null);

  /** The number of the pages, at least 1: an empty list still has its first page. */
  readonly pages = computed(() => Math.max(this.loaded()?.totalPages ?? 1, 1));

  constructor() {
    // `switchMap`: the answer for a page that has been left meanwhile is dropped.
    this.route.queryParamMap
      .pipe(
        map(parseUsersQuery),
        tap(() => this.loading.set(true)),
        switchMap(({ page, size }) => this.api.list(page - 1, size)),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result.ok) {
          this.loaded.set(result.body);
          this.error.set(null);
        } else {
          this.loaded.set(null);
          this.error.set(failureMessage(result.failure, FAILURE_MESSAGES));
        }
      });
  }

  /** Opens the page of the list, counted from 1. */
  open(page: number): void {
    this.navigate({ page, size: this.query().size });
  }

  /** Another size of the page starts from the first page: the old number means other rows. */
  resize(event: Event): void {
    this.navigate({ page: 1, size: Number((event.target as HTMLSelectElement).value) });
  }

  private navigate(query: UsersQuery): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: query, replaceUrl: true });
  }
}
