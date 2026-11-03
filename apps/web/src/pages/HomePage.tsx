import { FormattedMessage } from 'react-intl';

/** Slice 0 placeholder. Slice 1 replaces it with search (WEB-4, WEB-5). */
export function HomePage() {
  return (
    <section className="home" aria-labelledby="home-heading">
      <h1 id="home-heading">
        <FormattedMessage id="home.heading" />
      </h1>
      <p className="home__intro">
        <FormattedMessage id="home.intro" />
      </p>
      <p className="home__note">
        <FormattedMessage id="home.comingSoon" />
      </p>
    </section>
  );
}
