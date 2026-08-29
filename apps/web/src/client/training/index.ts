/**
 * The training section's front door: the two route components, and the one
 * import of its stylesheet.
 *
 * `App.tsx` is a choke-point file owned by another package (see
 * `ORCHESTRATION.md`); WP-T2's edit there is a nav link, two routes and this
 * single import, which is why the section exports itself from one module
 * instead of making the shell reach into four files.
 */

import './training.css';

export { TrainingIndex } from './TrainingIndex';
export { TechniquePage } from './TechniquePage';
