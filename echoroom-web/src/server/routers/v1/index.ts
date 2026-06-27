/**
 * v1 API routers — frozen snapshot of the v1 API contract.
 *
 * These routers provide backward-compatible access to the original API shapes.
 * New versions (v2, v3, etc.) can be added alongside without breaking existing clients.
 *
 * All v1 routers are functionally identical to their unversioned counterparts
 * at the time of versioning freeze. They will NOT receive breaking changes.
 */

export { adminV1Router } from "./admin";
export { authV1Router } from "./auth";
export { billingV1Router } from "./billing";
export { callsV1Router } from "./calls";
export { charactersV1Router } from "./characters";
export { clipsV1Router } from "./clips";
export { communityV1Router } from "./community";
export { dashboardV1Router } from "./dashboard";
export { profileV1Router } from "./profile";
export { scenariosV1Router } from "./scenarios";
export { socialV1Router } from "./social";
export { userV1Router } from "./user";
