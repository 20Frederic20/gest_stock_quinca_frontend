import { Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { ROLE_LABELS, Role, User } from '../../core/models/user.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { UsersService } from './users.service';

/** New accounts get the most limited role unless chosen otherwise. */
const DEFAULT_ROLE: Role = 'SELLER';

/**
 * Create form when `user` is null, edit form otherwise. Saves by itself.
 * The password is only asked at creation: afterwards it goes through the reset form.
 */
@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, FieldErrorComponent, SelectSearchComponent],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.css',
})
export class UserFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(UsersService);

  user = input<User | null>(null);
  /** Agencies a user can be attached to: the active ones. */
  agencies = input<Agency[]>([]);
  saved = output<void>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Texts shown in the selects; the form only holds the values. Reset with the user, overwritten by a choice.
  roleLabel = linkedSignal(() => ROLE_LABELS[this.user()?.role ?? DEFAULT_ROLE]);
  agencyLabel = linkedSignal(() => this.user()?.agencyLabel ?? '');

  // Same rules as UserRequest on the backend. Spaces around the identifier are removed before sending.
  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    username: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(50), Validators.pattern(/^\s*[a-zA-Z0-9._-]+\s*$/)],
    ],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
    role: [DEFAULT_ROLE, [Validators.required]],
    discountLimit: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    agencyId: ['', [Validators.required]],
  });

  roleOptions = computed<SelectOption[]>(() =>
    (Object.keys(ROLE_LABELS) as Role[]).map(role => ({ id: role, label: ROLE_LABELS[role] })),
  );

  agencyOptions = computed<SelectOption[]>(() =>
    this.agencies().map(agency => ({ id: agency.id, label: agency.label })),
  );

  constructor() {
    // Refills the form whenever another user is selected while the panel stays open.
    effect(() => {
      const user = this.user();
      this.formError.set(null);
      this.fieldErrors.set({});
      this.form.reset({
        name: user?.name ?? '',
        username: user?.username ?? '',
        password: '',
        role: user?.role ?? DEFAULT_ROLE,
        discountLimit: user?.discountLimit ?? 0,
        agencyId: user?.agencyId ?? '',
      });

      // A disabled control is ignored by the validation: no password is asked when editing.
      if (user) this.form.controls.password.disable();
      else this.form.controls.password.enable();
    });
  }

  onRoleSelected(option: SelectOption | null): void {
    if (!option) return;
    this.form.controls.role.setValue(option.id as Role);
    this.roleLabel.set(option.label);
  }

  onAgencySelected(option: SelectOption | null): void {
    this.form.controls.agencyId.setValue(option?.id ?? '');
    this.form.controls.agencyId.markAsTouched();
    this.agencyLabel.set(option?.label ?? '');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});

    const value = this.form.getRawValue();
    const update = {
      name: value.name.trim(),
      username: value.username.trim(),
      role: value.role,
      discountLimit: value.discountLimit,
      agencyId: value.agencyId,
    };
    const user = this.user();
    const request = user
      ? this.service.update(user.id, update)
      : this.service.create({ ...update, password: value.password });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
        this.fieldErrors.set(error.fieldErrors);
      },
    });
  }
}
