import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

@Component({
  selector: 'app-coming-soon',
  templateUrl: './coming-soon.component.html',
  styleUrl: './coming-soon.component.css',
})
export class ComingSoonComponent {
  private route = inject(ActivatedRoute);

  /** Read from the route data stream, so it updates even when Angular reuses the component. */
  title = toSignal(this.route.data.pipe(map(data => data['title'] as string)), { initialValue: '' });
}
