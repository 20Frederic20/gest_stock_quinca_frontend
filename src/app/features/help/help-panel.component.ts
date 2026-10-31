import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { HELP_SECTIONS } from './help-content';
import { sectionForUrl, sectionsForRole } from './help-match';

/** The guide of the logged-in role, opened on the section of the current screen. Created when the panel opens. */
@Component({
  selector: 'app-help-panel',
  imports: [NgTemplateOutlet],
  templateUrl: './help-panel.component.html',
  styleUrl: './help-panel.component.css',
})
export class HelpPanelComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  sections = computed(() => {
    const role = this.auth.user()?.role;
    return role ? sectionsForRole(role, HELP_SECTIONS) : [];
  });

  /** Fixed when the panel opens: navigating while it is open does not move the reader. */
  currentId = sectionForUrl(this.sections(), this.router.url)?.id;

  constructor() {
    // Once the drawer is rendered and laid out: before that the offsets are all zero.
    afterNextRender(() => {
      if (this.currentId) this.jumpTo(this.currentId);
    });
  }

  /** Scrolls the drawer's own scroll container so the section sits at its top. */
  jumpTo(id: string): void {
    const target = this.host.nativeElement.querySelector<HTMLElement>(`#help-${id}`);
    const container = this.host.nativeElement.closest<HTMLElement>('.content');
    if (!target || !container) return;
    container.scrollTop += target.getBoundingClientRect().top - container.getBoundingClientRect().top;
  }
}
