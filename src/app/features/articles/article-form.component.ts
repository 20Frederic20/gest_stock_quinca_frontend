import { Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ZXingScannerModule } from '@zxing/ngx-scanner'; // <-- AJOUT
import { ApiError } from '../../core/http/api-error.model';
import { Article } from '../../core/models/article.model';
import { Family } from '../../core/models/family.model';
import { UnitOfMeasure } from '../../core/models/unit-of-measure.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { buildFamilyTree } from '../families/family-tree';
import { percentToRate, rateToPercent } from './article-format';
import { ArticlesService } from './articles.service';
import { BarcodeFormat } from '@zxing/library';

const DEFAULT_VAT_PERCENT = 18;

const unitOptionLabel = (unit: UnitOfMeasure) => `${unit.code} — ${unit.label}`;

@Component({
  selector: 'app-article-form',
  imports: [
    ReactiveFormsModule,
    FieldErrorComponent,
    SelectSearchComponent,
    ZXingScannerModule // <-- AJOUT
  ],
  templateUrl: './article-form.component.html',
  styleUrl: './article-form.component.css',
})
export class ArticleFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(ArticlesService);

  article = input<Article | null>(null);
  families = input<Family[]>([]);
  units = input<UnitOfMeasure[]>([]);
  saved = output<void>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Signal pour afficher/cacher le scanner
  isScanning = signal(false);

  readonly allowedFormats: BarcodeFormat[] = [
    BarcodeFormat.CODE_128,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E
  ];

  familyLabel = linkedSignal(() => this.article()?.familyLabel ?? '');
  unitLabel = linkedSignal(() => {
    const article = this.article();
    const unit = this.units().find(u => u.id === article?.stockUnitId);
    return unit ? unitOptionLabel(unit) : (article?.stockUnitCode ?? '');
  });

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    barcode: ['', [Validators.maxLength(50)]],
    designation: ['', [Validators.required, Validators.maxLength(200)]],
    alertThreshold: [0, [Validators.required, Validators.min(0)]],
    vatRate: [DEFAULT_VAT_PERCENT, [Validators.required, Validators.min(0), Validators.max(100)]],
    familyId: ['', [Validators.required]],
    stockUnitId: ['', [Validators.required]],
    price: [0, [Validators.min(0)]],
  });

  familyOptions = computed<SelectOption[]>(() =>
    buildFamilyTree(this.families()).map(row => ({ id: row.family.id, label: row.family.label })),
  );

  unitOptions = computed<SelectOption[]>(() =>
    this.units().map(unit => ({ id: unit.id, label: unitOptionLabel(unit) })),
  );

  constructor() {
    effect(() => {
      const article = this.article();
      this.formError.set(null);
      this.fieldErrors.set({});
      this.isScanning.set(false); // <-- Arrêter le scan si on change d'article
      this.form.reset({
        code: article?.code ?? '',
        barcode: article?.barcode ?? '',
        designation: article?.designation ?? '',
        alertThreshold: article?.alertThreshold ?? 0,
        vatRate: article ? rateToPercent(article.vatRate) : DEFAULT_VAT_PERCENT,
        familyId: article?.familyId ?? '',
        stockUnitId: article?.stockUnitId ?? '',
        price: 0,
      });
    });
  }

  onFamilySelected(option: SelectOption | null): void {
    this.form.controls.familyId.setValue(option?.id ?? '');
    this.form.controls.familyId.markAsTouched();
    this.familyLabel.set(option?.label ?? '');
  }

  onUnitSelected(option: SelectOption | null): void {
    this.form.controls.stockUnitId.setValue(option?.id ?? '');
    this.form.controls.stockUnitId.markAsTouched();
    this.unitLabel.set(option?.label ?? '');
  }

  // --- MÉTHODES POUR LE SCANNER ---

  toggleScanner(): void {
    this.isScanning.update(v => !v);
  }

  onBarcodeScanned(barcode: string): void {
    this.form.controls.barcode.setValue(barcode);
    this.isScanning.set(false); // Arrêter le scan après une détection réussie
  }

  // --------------------------------

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const article = this.article();

    if (!article && this.form.controls.price.value <= 0) {
      this.form.controls.price.markAsTouched();
      this.formError.set('Le prix de vente est obligatoire pour un nouvel article.');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});

    const { price, ...value } = this.form.getRawValue();
    const body = {
      ...value,
      barcode: value.barcode.trim() || null,
      vatRate: percentToRate(value.vatRate),
      ...(article ? {} : { price }),
    };
    const request = article ? this.service.update(article.id, body) : this.service.create(body);

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
