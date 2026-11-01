import { useTranslation } from 'react-i18next'
import { LOCALES, SUPPORTED_LOCALES, isLocale, type Locale } from '../../i18n/locales'

interface Props {
  onChange?: (locale: Locale) => void
}

export function LanguageSwitcher({ onChange }: Props) {
  const { t, i18n } = useTranslation('common')
  const current = isLocale(i18n.language) ? i18n.language : undefined
  const isBeta = current ? LOCALES[current].status === 'beta' : false

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
      {isBeta && (
        <p className="beta-notice" role="note">
          {t('language.betaNotice')}
        </p>
      )}
    </div>
  )
}
