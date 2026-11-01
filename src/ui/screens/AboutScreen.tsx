import { Trans, useTranslation } from 'react-i18next'
import { COPYRIGHT_YEAR, CONTACT_EMAIL } from '../../config'
import type { EngineInfo } from '../../core/engine/provider'

/** Third-party components; names are proper nouns and stay untranslated. */
const THIRD_PARTY = [
  { name: 'chess.js', license: 'BSD-2-Clause', url: 'https://github.com/jhlywa/chess.js' },
  { name: 'react-chessboard', license: 'MIT', url: 'https://github.com/Clariity/react-chessboard' },
  { name: 'React', license: 'MIT', url: 'https://react.dev' },
  { name: 'i18next / react-i18next', license: 'MIT', url: 'https://www.i18next.com' },
  { name: 'posthog-js', license: 'MIT', url: 'https://github.com/PostHog/posthog-js' },
  { name: 'Lichess puzzle database', license: 'CC0', url: 'https://database.lichess.org/#puzzles' },
] as const

interface Props {
  engine: EngineInfo
  onExit: () => void
}

export function AboutScreen({ engine, onExit }: Props) {
  const { t } = useTranslation('about')
  const gplUrl = `${import.meta.env.BASE_URL}engine/Copying.txt`
  return (
    <section className="about" aria-labelledby="about-title">
      <button type="button" className="link-button" onClick={onExit}>
        {t('common:nav.map')}
      </button>
      <h2 id="about-title">{t('title')}</h2>
      <p>{t('intro')}</p>

      <h3>{t('appLicense.title')}</h3>
      <p>{t('appLicense.body', { year: COPYRIGHT_YEAR })}</p>

      <h3>{t('engine.title')}</h3>
      <p>{t('engine.body', { name: engine.name, license: engine.license })}</p>
      <dl className="facts">
        <dt>{t('engine.version')}</dt>
        <dd>{engine.version}</dd>
        <dt>{t('engine.build')}</dt>
        <dd>
          <code>{engine.build}</code>
        </dd>
        <dt>{t('engine.source')}</dt>
        <dd>
          <a href={engine.sourceUrl}>{engine.sourceUrl}</a>
        </dd>
        <dt>{t('engine.upstream')}</dt>
        <dd>
          <a href={engine.upstreamUrl}>{engine.upstreamUrl}</a>
        </dd>
        <dt>{t('engine.licenseText')}</dt>
        <dd>
          <a href={gplUrl}>{t('engine.gplLink')}</a>
        </dd>
      </dl>
      <p>
        <Trans t={t} i18nKey="engine.offer" values={{ email: CONTACT_EMAIL }} components={{ mail: <a href={`mailto:${CONTACT_EMAIL}`} /> }} />
      </p>

      <h3>{t('thirdParty.title')}</h3>
      <ul className="third-party">
        {THIRD_PARTY.map((c) => (
          <li key={c.name}>
            <a href={c.url}>{c.name}</a> · {c.license}
          </li>
        ))}
      </ul>

      <h3>{t('privacy.title')}</h3>
      <p>{t('privacy.body')}</p>

      <h3>{t('contact.title')}</h3>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </section>
  )
}
