import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';

/** Only a path inside the application: `?redirect=https://…` must not send the user elsewhere. */
function safeRedirect(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\') ? url : '/';
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, FieldErrorComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  /** Page to open after logging in, from the `?redirect=` query parameter. */
  redirect = input<string | undefined>(undefined);

  submitting = signal(false);
  showPassword = signal(false);
  formError = signal<string | null>(null);
  startupError = this.auth.startupError;

  form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  togglePassword(): void {
    this.showPassword.update(shown => !shown);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);
    const { username, password } = this.form.getRawValue();

    this.auth.login(username.trim(), password).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl(safeRedirect(this.redirect()));
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.formError.set(error.message);
        // The identifier stays: a typo in the password is the usual mistake.
        this.form.controls.password.reset();
      },
    });
  }
}
