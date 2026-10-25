# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. Every document in `/bills/{billId}` must have an `ownerId` matching `request.auth.uid` upon creation.
2. Only verified authenticated users (`request.auth != null && request.auth.token.email_verified == true`) can create, update, or delete their own `/bills/{billId}` documents.
3. Document IDs `{billId}` must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
4. `ownerId` and `createdAt` are immutable across updates.
5. `allow list` on `/bills/{billId}` is strictly constrained to `resource.data.ownerId == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads
1. Unauthenticated create on `/bills/sb-123` -> Denied (`isSignedIn()` fails).
2. Unverified email create on `/bills/sb-123` -> Denied (`email_verified == true` fails).
3. Spoofed `ownerId` (`ownerId != request.auth.uid`) -> Denied.
4. Oversized `title` (`> 200` chars) -> Denied.
5. Shadow field injection (`extraGhostField: true`) -> Denied (`hasOnly` check fails).
6. Invalid document ID with special characters -> Denied (`isValidId` fails).
7. Mutating `ownerId` during update -> Denied.
8. Mutating `createdAt` during update -> Denied.
9. Client-forged `createdAt` timestamp (`createdAt != request.time`) -> Denied.
10. Blanket list query across all users' bills -> Denied (`resource.data.ownerId == request.auth.uid` enforced).
11. Non-owner attempting to delete a bill -> Denied.
12. Value poisoning (`grandTotal` as string instead of number) -> Denied.
