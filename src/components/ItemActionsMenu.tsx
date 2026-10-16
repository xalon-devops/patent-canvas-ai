import React, { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  name: string;
  itemLabel?: string;
  onRename: (name: string) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}

/** Shared ⋯ menu for saved items: rename and delete with confirmation. */
export const ItemActionsMenu: React.FC<Props> = ({ name, itemLabel = 'item', onRename, onDelete }) => {
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const save = async () => {
    const v = value.trim();
    if (!v) { setError('Enter a name.'); return; }
    if (v.length > 120) { setError('Keep the name under 120 characters.'); return; }
    setBusy(true); setError(null);
    try { await onRename(v); setRenaming(false); }
    catch (e: any) { setError(e?.message || 'Could not rename. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={stop} onKeyDown={stop}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={`Options for ${name}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card">
          <DropdownMenuItem onClick={() => { setValue(name); setError(null); setRenaming(true); }}>
            <Pencil className="h-4 w-4 mr-2" />Rename
          </DropdownMenuItem>
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 mr-2" />Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Rename {itemLabel}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-2">
            <Input autoFocus value={value} maxLength={120} onChange={(e) => setValue(e.target.value)} aria-label="Name" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {onDelete && (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
              <AlertDialogDescription>This permanently removes the {itemLabel} and its saved results.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDelete()}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default ItemActionsMenu;
