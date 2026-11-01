import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TuiTable, TuiTablePagination, TuiTablePaginationEvent } from '@taiga-ui/addon-table';
import { TuiIcon, TuiLoader, TuiNotification } from '@taiga-ui/core';
import { map, switchMap, tap } from 'rxjs';
import { failureMessage } from '../api/api-error';
import { PageBarComponent } from '../layout/page-bar.component';
import { RoleBadgeComponent } from '../layout/role-badge.component';
import { FitEmailComponent } from './fit-email.component';
import { UserPage } from './users.model';
import { UsersApiService } from './users-api.service';
import { PAGE_SIZES, UsersQuery, UsersSortKey, nextSort, parseUsersQuery } from './users-query';

const FAILURE_MESSAGES = { FORBIDDEN: 'You do not have permission to manage users.' };

/** The columns of the table, each sorted by the backend on a click of its head. */
const COLUMNS: readonly { key: UsersSortKey; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
];

/**
 * The list of the users, a page at a time (`GET /api/v1/users`); for the administrators, who have
 * the permission `USER_MANAGE`. Anyone else who opens it gets the 403 of the backend as a message.
 *
 * The page, its size and the order are in the query of the URL
 * (`?page=2&size=100&sort=email&direction=asc`, the page counted from 1), so that a reload and a link
 * keep them; a change replaces the entry of the history rather than adding one, so that *Back*
 * leaves the list.
 *
 * The backend sorts the list: a click on the head of a column sorts by it (the id from the newest,
 * the email and the role alphabetically, {@link nextSort}), a second click the other way round, and
 * the list starts again from its first page. The head of the column sorted by has an arrow of the
 * direction and `aria-sort`; the others a grey double arrow. The pager is the one of Taiga UI
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
    TuiIcon,
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
                  @for (column of columns; track column.key) {
                    <th
                      tuiTh
                      scope="col"
                      [class.id]="column.key === 'id'"
                      [resizable]="false"
                      [attr.aria-sort]="ariaSort(column.key)"
                    >
                      <button type="button" class="sort" [class.active]="query().sort === column.key" (click)="sortBy(column.key)">
                        {{ column.label }}
                        <tui-icon class="arrow" [icon]="arrow(column.key)" />
                      </button>
                    </th>
                  }
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
      /* The whole head is the button of the order of its column. */
      .sort {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0;
        border: none;
        background: none;
        font: inherit;
        color: inherit;
        cursor: pointer;
      }
      .sort:hover,
      .sort.active {
        color: var(--tui-text-primary);
      }
      .arrow {
        font-size: 1rem;
        color: var(--tui-text-tertiary);
      }
      .sort.active .arrow {
        color: var(--tui-text-action);
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
  protected readonly columns = COLUMNS;

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
        switchMap(({ page, size, sort, direction }) => this.api.list(page - 1, size, { sort, direction })),
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
    this.navigate({ ...this.query(), page: size === this.query().size ? page + 1 : 1, size });
  }

  /** Sorts by the column, or the other way round when sorted by it already, from the first page. */
  protected sortBy(column: UsersSortKey): void {
    this.navigate({ ...this.query(), ...nextSort(this.query(), column), page: 1 });
  }

  /** `aria-sort` of the head of the column: only the column sorted by has one. */
  protected ariaSort(column: UsersSortKey): 'ascending' | 'descending' | null {
    const { sort, direction } = this.query();
    return sort !== column ? null : direction === 'asc' ? 'ascending' : 'descending';
  }

  protected arrow(column: UsersSortKey): string {
    const { sort, direction } = this.query();
    return sort !== column ? '@tui.arrow-up-down' : direction === 'asc' ? '@tui.arrow-up' : '@tui.arrow-down';
  }

  private navigate(query: UsersQuery): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: query, replaceUrl: true });
  }
}
