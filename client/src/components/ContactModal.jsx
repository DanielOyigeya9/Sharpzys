import { useState, useEffect } from 'react';
import '../styles/contact-modal.css';

const SUPPORT_PHONE = '08126650458';
const SUPPORT_EMAIL = 'Sharpzytravels@gmail.com';
const WHATSAPP_NUM = '07030642390';
const WHATSAPP_INTL = '2347030642390';

function ContactModal({ isOpen: externalIsOpen, onClose: externalOnClose }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const handleClose = () => {
    if (externalOnClose) {
      externalOnClose();
    }
    setInternalIsOpen(false);
  };

  useEffect(() => {
    const handleOpenEvent = () => {
      setInternalIsOpen(true);
    };

    window.addEventListener('open-contact-modal', handleOpenEvent);
    return () => {
      window.removeEventListener('open-contact-modal', handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(''), 2500);
    }).catch(() => {
      // Fallback
    });
  };

  if (!isOpen) return null;

  return (
    <div className="contact-modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="contactModalTitle">
      <div className="contact-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="contact-modal-header">
          <div className="header-meta">
            <span className="live-status-tag">24/7 SUPPORT DESK</span>
          </div>
          <h2 id="contactModalTitle">CONTACT SHARPZYTRAVELS</h2>
          <p>Get in touch directly with our flight booking & customer operations team.</p>
          <button type="button" className="contact-modal-close" onClick={handleClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="contact-modal-body">
          {/* Direct Call Card */}
          <div className="contact-option-card">
            <div className="option-details">
              <span className="option-category">PHONE SUPPORT</span>
              <strong className="option-value">{SUPPORT_PHONE}</strong>
              <span className="option-sub">Direct line for booking inquiries & support</span>
            </div>
            <div className="option-actions">
              <a href={`tel:${SUPPORT_PHONE}`} className="contact-btn call-btn">
                CALL NOW
              </a>
              <button
                type="button"
                className="contact-btn copy-btn"
                onClick={() => copyToClipboard(SUPPORT_PHONE, 'phone')}
              >
                {copiedField === 'phone' ? 'COPIED ✓' : 'COPY'}
              </button>
            </div>
          </div>

          {/* Email Support Card */}
          <div className="contact-option-card">
            <div className="option-details">
              <span className="option-category">EMAIL ADDRESS</span>
              <strong className="option-value">{SUPPORT_EMAIL}</strong>
              <span className="option-sub">Official customer support & ticket desk</span>
            </div>
            <div className="option-actions">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="contact-btn email-btn">
                SEND EMAIL
              </a>
              <button
                type="button"
                className="contact-btn copy-btn"
                onClick={() => copyToClipboard(SUPPORT_EMAIL, 'email')}
              >
                {copiedField === 'email' ? 'COPIED ✓' : 'COPY'}
              </button>
            </div>
          </div>

          {/* WhatsApp Support Card */}
          <div className="contact-option-card">
            <div className="option-details">
              <span className="option-category">WHATSAPP DESK</span>
              <strong className="option-value">{WHATSAPP_NUM}</strong>
              <span className="option-sub">Instant messaging & reservation updates</span>
            </div>
            <div className="option-actions">
              <a
                href={`https://wa.me/${WHATSAPP_INTL}?text=${encodeURIComponent('Hello SharpzyTravels, I need assistance with a flight booking.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-btn whatsapp-btn"
              >
                CHAT ON WHATSAPP
              </a>
              <button
                type="button"
                className="contact-btn copy-btn"
                onClick={() => copyToClipboard(WHATSAPP_NUM, 'whatsapp')}
              >
                {copiedField === 'whatsapp' ? 'COPIED ✓' : 'COPY'}
              </button>
            </div>
          </div>
        </div>

        <div className="contact-modal-footer">
          <span>SHARPZYTRAVELS • CUSTOMER SERVICE & TICKETING DESK</span>
          <button type="button" className="done-close-btn" onClick={handleClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

export function openContactModal() {
  window.dispatchEvent(new CustomEvent('open-contact-modal'));
}

export default ContactModal;
