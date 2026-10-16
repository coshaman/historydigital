(function attachMain20LifeSimulation(root) {
  function valueAtPath(value, path) {
    return String(path || '').split('.').filter(Boolean).reduce((current, key) => current == null ? undefined : current[key], value);
  }

  function buildLifeTimeline(state, templates) {
    return (templates?.periods || []).map((period) => {
      const key = valueAtPath(state, period.statePath);
      const selected = period.variants && Object.hasOwn(period.variants, String(key)) ? period.variants[String(key)] : period.default;
      return { ...selected, periodId: period.id, year: period.year, periodLabel: `${period.year}년`, basis: [...(selected?.basis || [])] };
    }).filter((episode) => episode.id && episode.fictional === true);
  }

  root.Main20LifeSimulation = Object.freeze({ buildLifeTimeline });
})(globalThis);
