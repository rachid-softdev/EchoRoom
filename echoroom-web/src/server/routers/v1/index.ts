/**
 * v1 API routers — frozen snapshot of the v1 API contract.
 *
 * These routers provide backward-compatible access to the original API shapes.
 * New versions (v2, v3, etc.) can be added alongside without breaking existing clients.
 *
 * All v1 routers are functionally identical to their unversioned counterparts
 * at the time of versioning freeze. They will NOT receive breaking changes.
 */
export { scenariosV1Router } from "./scenarios";
export { authV1Router } from "./auth";
export { charactersV1Router } from "./characters";
export { callsV1Router } from "./calls";
export { billingV1Router } from "./billing";
export { communityV1Router } from "./community";
export { adminV1Router } from "./admin";
export { socialV1Router } from "./social";
export { clipsV1Router } from "./clips";
export { profileV1Router } from "./profile";
export { userV1Router } from "./user";
export { dashboardV1Router } from "./dashboard";
