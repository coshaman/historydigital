# V37 resident candidate crosswalk

The supplied 36-person file is fictional composite design data. `data/v37_resident_crosswalk.json` records candidate overlaps with current runtime cards, but deliberately does not merge or import any profile fields.

The strongest candidates include Alexei Orlov and Pavel Antonov, whose names and occupations match their runtime cards. Other candidates have conflicting occupations, such as Ekaterina Belova (bookseller in the bundle, proofreader in runtime) and Maria/Mariya (apprentice versus laundress). Similar first names or jobs alone are not enough to establish identity. The bundle's cash is expressed in rubles while runtime gameplay uses kopeks; direct numeric migration would corrupt balances. Family, housing, schedules, and goals also need field-level review.

All 36 bundle IDs have a disposition. Candidate links are not identity claims; no bundle stats, kinship, money, housing, or quest state is imported. The one fictional Anna/Mariya household in runtime remains explicitly labeled as runtime design and is not presented as a verified historical or proven identity merge.

Audit command: `node scripts/v37-resident-crosswalk-test.mjs`.
