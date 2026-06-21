import { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import Select from '../../../shared/components/Select';
import {
  CATEGORIES,
  COLORS,
  COLOR_SWATCHES,
  FITS,
  PATTERNS,
  SEASONS,
  SUB_TYPES,
  type ClothingColor,
} from '../options';
import { itemIsComplete, type ScanFields } from '../bulkAdd';

type EditItemSheetProps = {
  /** Preview thumbnail for the item being edited. */
  imageUrl: string;
  fields: ScanFields;
  onSave: (fields: ScanFields) => void;
  onClose: () => void;
};

function ColorDot({ color }: { color: ClothingColor | '' }) {
  if (!color) return null;
  const swatch = COLOR_SWATCHES[color];
  return (
    <span
      className="inline-block h-4 w-4 shrink-0 rounded-full border border-black/10"
      style={
        swatch.startsWith('linear')
          ? { backgroundImage: swatch }
          : { backgroundColor: swatch }
      }
    />
  );
}

/**
 * Bottom sheet for correcting one detected item before it is added to the
 * wardrobe. Edits a local draft and only commits to the parent on Save.
 */
export default function EditItemSheet({
  imageUrl,
  fields,
  onSave,
  onClose,
}: EditItemSheetProps) {
  const [draft, setDraft] = useState<ScanFields>(fields);
  const complete = itemIsComplete(draft);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <motion.button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-espresso/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Sheet */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Edit item"
        className="relative max-h-[88vh] overflow-y-auto rounded-t-xl border-t border-border bg-background p-6 pb-8"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-sand" />

        <div className="mb-5 flex items-center justify-between">
          <h4 className="font-serif">Edit Item</h4>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost btn-icon"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 flex items-center gap-4">
          <img
            src={imageUrl}
            alt="Item"
            className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover"
          />
          <input
            type="text"
            className="input"
            value={draft.name}
            placeholder="e.g. Navy Blue Jeans"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Occasion
            </label>
            <Select
              options={CATEGORIES}
              value={draft.category}
              placeholder="Select occasion…"
              onChange={(category) => setDraft((d) => ({ ...d, category }))}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Type
            </label>
            <Select
              options={SUB_TYPES}
              value={draft.sub_type}
              placeholder="Select type…"
              onChange={(sub_type) => setDraft((d) => ({ ...d, sub_type }))}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-espresso">
              Color <ColorDot color={draft.color} />
            </label>
            <Select
              options={COLORS}
              value={draft.color}
              placeholder="Select color…"
              onChange={(color) => setDraft((d) => ({ ...d, color }))}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Fit
            </label>
            <Select
              options={FITS}
              value={draft.fit}
              placeholder="Select fit…"
              onChange={(fit) => setDraft((d) => ({ ...d, fit }))}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Season
            </label>
            <Select
              options={SEASONS}
              value={draft.season}
              placeholder="Select season…"
              onChange={(season) => setDraft((d) => ({ ...d, season }))}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <label className="block text-xs font-medium uppercase tracking-widest text-espresso">
              Pattern
            </label>
            <Select
              options={PATTERNS}
              value={draft.pattern}
              placeholder="Select pattern…"
              onChange={(pattern) => setDraft((d) => ({ ...d, pattern }))}
            />
          </fieldset>
        </div>

        <button
          type="button"
          disabled={!complete}
          onClick={() => onSave(draft)}
          className="btn-primary btn-lg mt-6 w-full"
        >
          Save
        </button>
      </motion.div>
    </div>
  );
}
