export interface FolhaProVisibilityInput {
  isAdmin: boolean;
  isGestor: boolean;
  showToManagers: boolean;
}

export function shouldShowFolhaProButton({
  isAdmin,
  isGestor,
  showToManagers,
}: FolhaProVisibilityInput): boolean {
  // Administrators always see the link; collaborators never do.
  return isAdmin || (isGestor && showToManagers);
}
