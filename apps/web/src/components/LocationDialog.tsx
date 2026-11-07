import { useEffect, useId, useRef } from 'react';
import { FormattedMessage } from 'react-intl';

/**
 * WEB-4: the person volunteers their location here, after reading how it's used. Nothing is asked of the browser
 * until they choose to share. A native modal dialog: the page behind it is inert, focus starts on its first button,
 * Escape closes it, and focus goes back to the button that opened it.
 */
export function LocationDialog({ open, onShare, onCancel }: { open: boolean; onShare: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.hasAttribute('open')) dialog.showModal();
    if (!open && dialog.hasAttribute('open')) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Escape: close through our own state, so it stays in step.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="dialog__body">
        <h2 id={titleId} className="dialog__title">
          <FormattedMessage id="location.dialog.title" />
        </h2>
        <p id={bodyId}>
          <FormattedMessage id="location.dialog.body" />
        </p>
        <p className="dialog__note">
          <FormattedMessage id="location.dialog.browser" />
        </p>
        <div className="dialog__actions">
          <button type="button" className="button" onClick={onShare}>
            <FormattedMessage id="location.dialog.share" />
          </button>
          <button type="button" className="button button--secondary" onClick={onCancel}>
            <FormattedMessage id="location.dialog.cancel" />
          </button>
        </div>
      </div>
    </dialog>
  );
}
