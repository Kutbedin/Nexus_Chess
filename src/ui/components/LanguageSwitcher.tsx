import { useTranslation } from 'react-i18next'
import { CONTACT_EMAIL } from '../../config'
import { LOCALES, SUPPORTED_LOCALES, isLocale, type Locale } from '../../i18n/locales'

interface Props {
  onChange?: (locale: Locale) => void
  onReportOpened?: (locale: Locale) => void
  /** Name of the current screen, included in the report so we know where the text was. */
  screen: string
}

export function LanguageSwitcher({ onChange, onReportOpened, screen }: Props) {
  const { t, i18n } = useTranslation('common')
  const current = isLocale(i18n.language) ? i18n.language : undefined
  const isBeta = current ? LOCALES[current].status === 'beta' : false

  const reportHref = current
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[translation][${current}] ${screen}`)}&body=${encodeURIComponent(
        t('language.reportTemplate', { locale: current, screen }),
      )}`
    : undefined

  return (
    <div className="language-switcher">
      <label>
        <span className="visually-hidden">{t('language.label')}</span>
        <select
          value={current}
          onChange={(e) => {
            const next = e.target.value
            if (!isLocale(next)) return
            void i18n.changeLanguage(next)
            onChange?.(next)
          }}
        >
          {SUPPORTED_LOCALES.map((code) => (
            <option key={code} value={code} lang={code}>
              {LOCALES[code].status === 'beta' ? `${LOCALES[code].nativeName} (${t('language.beta')})` : LOCALES[code].nativeName}
            </option>
          ))}
        </select>
      </label>
      {isBeta && current && (
        <p className="beta-notice" role="note">
          {t('language.betaNotice')}{' '}
          <a className="report-link" href={reportHref} onClick={() => onReportOpened?.(current)}>
            {t('language.reportError')}
          </a>
        </p>
      )}
    </div>
  )
}
