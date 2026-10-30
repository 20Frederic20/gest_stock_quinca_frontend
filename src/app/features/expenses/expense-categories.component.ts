import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { ExpenseCategory } from '../../core/models/expense.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { ExpenseCategoriesService } from './expense-categories.service';

/** "Catégories" tab: add, rename, deactivate or delete the charge categories. */
@Component({
  selector: 'app-expense-categories',
  imports: [ReactiveFormsModule, StateViewComponent, BadgeComponent, ConfirmDialogComponent],
  templateUrl: './expense-categories.component.html',
  styleUrl: './expense-categories.component.css',
})
export class ExpenseCategoriesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(ExpenseCategoriesService);

  categories = signal<ExpenseCategory[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  /** Action failure (e.g. category in use): the backend message, shown above the table. */
  actionError = signal<string | null>(null);

  /** null while adding a new category. */
  editing = signal<ExpenseCategory | null>(null);
  toDelete = signal<ExpenseCategory | null>(null);
  deleteMessage = computed(
    () => `La catégorie « ${this.toDelete()?.label ?? ''} » sera définitivement supprimée.`,
  );

  form = this.fb.nonNullable.group({
    label: ['', [Validators.required, Validators.maxLength(100)]],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getAll(false).subscribe({
      next: categories => {
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  startEdit(category: ExpenseCategory): void {
    this.editing.set(category);
    this.form.controls.label.setValue(category.label);
  }

  cancelEdit(): void {
    this.editing.set(null);
    this.form.reset();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.actionError.set(null);
    const label = this.form.controls.label.value.trim();
    const editing = this.editing();
    const request = editing
      ? this.service.update(editing.id, { label, description: editing.description })
      : this.service.create({ label });

    request.subscribe({
      next: () => {
        this.cancelEdit();
        this.load();
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  toggleActive(category: ExpenseCategory): void {
    this.actionError.set(null);
    const request = category.active ? this.service.deactivate(category.id) : this.service.activate(category.id);
    request.subscribe({
      next: () => this.load(),
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  askDelete(category: ExpenseCategory): void {
    this.toDelete.set(category);
  }

  cancelDelete(): void {
    this.toDelete.set(null);
  }

  confirmDelete(): void {
    const category = this.toDelete();
    if (!category) return;
    this.toDelete.set(null);
    this.actionError.set(null);

    this.service.delete(category.id).subscribe({
      next: () => this.load(),
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }
}
