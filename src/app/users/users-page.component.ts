import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TuiTable, TuiTablePagination, TuiTablePaginationEvent } from '@taiga-ui/addon-table';
import { TuiLoader, TuiNotification } from '@taiga-ui/core';
import { map, switchMap, tap } from 'rxjs';
import { failureMessage } from '../api/api-error';
import { PageBarComponent } from '../layout/page-bar.component';
import { RoleBadgeComponent } from '../layout/role-badge.component';
import { FitEmailComponent } from './fit-email.component';
import { UserPage } from './users.model';
import { UsersApiService } from './users-api.service';
import { PAGE_SIZES, UsersQuery, parseUsersQuery } from './users-query';

const FAILURE_MESSAGES = { FORBIDDEN: 'You do not have permission to manage users.' };

/**
 * The list of the users, a page at a time (`GET /api/v1/users`); for the administrators, who have
 * the permission `USER_MANAGE`. Anyone else who opens it gets the 403 of the backend as a message.
 *
 * The page and its size are in the query of the URL (`?page=2&size=100`, the page counted from 1),
 * so that a reload and a link keep them; a change replaces the entry of the history rather than
 * adding one, so that *Back* leaves the list. The pager is the one of Taiga UI
 * (`tui-table-pagination`): the number of the pages, the rows shown out of all as a menu of the
 * sizes, and the previous and the next page.
 *
 * The email takes the rest of the width of the table and is cut only when it does not fit
 * ({@link FitEmailComponent}); the id and the role, the badge of its colour
 * ({@link RoleBadgeComponent}), are as wide as their texts.
 *
 * The table is as high as its rows, up to the bottom of the window: then it scrolls inside its box,
 * under a fixed head, while the pager below stays in view. While the next page loads, the rows of
 * the previous one stay under a loader, so that the table does not jump.
 */
@Component({
  selector: 'app-users-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageBarComponent,
    FitEmailComponent,
    RoleBadgeComponent,
    TuiTable,
    TuiTablePagination,
    TuiLoader,
    TuiNotification,
  ],
  // `fills-window`: see `styles.css`, the page takes the rest of the window.
  host: { class: 'fills-window' },
  template: `
    <app-page-bar title="Users" />

    <section class="card" [attr.aria-busy]="loading()">
      @if (error(); as message) {
        <div tuiNotification appearance="negative" size="m" role="alert">{{ message }}</div>
      } @else if (rows() === null) {
        <div class="note"><tui-loader size="s" [inheritColor]="true" />Loading…</div>
      } @else {
        <tui-loader class="loader" [overlay]="true" [loading]="loading()">
          <div class="scroll" tabindex="0" aria-label="Users">
            <table tuiTable size="s">
              <thead tuiThead>
                <tr>
                  <th tuiTh scope="col" class="id" [resizable]="false">ID</th>
                  <th tuiTh scope="col" [resizable]="false">Email</th>
                  <th tuiTh scope="col" [resizable]="false">Role</th>
                </tr>
              </thead>
              <tbody tuiTbody>
                @for (row of rows(); track row.id) {
                  <tr tuiTr>
                    <td tuiTd class="id">{{ row.id }}</td>
                    <td tuiTd class="email"><app-fit-email [email]="row.email" /></td>
                    <td tuiTd>
                      <app-role-badge [role]="row.role" />
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td tuiTd colspan="3" class="note">{{ total() === 0 ? 'No users.' : 'No users on this page.' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </tui-loader>
      }

      @if (!error()) {
        <tui-table-pagination
          class="pager"
          [items]="sizes"
          [total]="total() ?? 0"
          [page]="query().page - 1"
          [size]="query().size"
          (paginationChange)="change($event)"
        />
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
        gap: 0.75rem;
        min-height: 0;
        padding: 1rem;
        background: var(--tui-background-base);
        border-radius: var(--tui-radius-l);
        box-shadow: 0 0.25rem 1.5rem rgba(0, 0, 0, 0.06);
      }
      /* As high as the rows, up to the rest of the window; then the rows scroll under the head.
         The loader is a grid of one cell (its content and its spinner over it): the cell shrinks
         with the loader, and the rows scroll inside it. */
      .loader {
        flex: 0 1 auto;
        grid-template-rows: minmax(0, 1fr);
        min-height: 0;
      }
      .scroll {
        max-height: 100%;
        overflow: auto;
      }
      table {
        width: 100%;
      }
      th,
      td {
        white-space: nowrap;
      }
      .id {
        text-align: right;
        color: var(--tui-text-secondary);
        font-variant-numeric: tabular-nums;
      }
      /* The rest of the width, whatever the length of the email: the cell adds nothing to the
         widths that the table needs, its text is cut instead. */
      .email {
        width: 100%;
        max-width: 0;
      }
      .note {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1.5rem;
        color: var(--tui-text-secondary);
      }
      .pager {
        flex: none;
      }
    `,
  ],
})
export class UsersPageComponent {
  private readonly api = inject(UsersApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly sizes = [...PAGE_SIZES];

  readonly query = toSignal(this.route.queryParamMap.pipe(map(parseUsersQuery)), { requireSync: true });

  /** The last page that the backend answered; kept while the next one loads. */
  private readonly loaded = signal<UserPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly rows = computed(() => this.loaded()?.items ?? null);

  readonly total = computed(() => this.loaded()?.totalElements ?? null);

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

  /**
   * Opens the page that the pager asks, counted from 0 there and from 1 in the URL. Another size
   * starts from the first page: the old number means other rows.
   */
  protected change({ page, size }: TuiTablePaginationEvent): void {
    this.navigate({ page: size === this.query().size ? page + 1 : 1, size });
  }

  private navigate(query: UsersQuery): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: query, replaceUrl: true });
  }
}
