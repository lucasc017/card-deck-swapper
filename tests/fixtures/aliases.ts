export const slimeOracleId = '21f45043-5419-4019-8b6c-e5294bd5f549';
export const slimeAliasCard = {
  name: 'Acidic Slime', flavor_name: 'Marauding Mutagen', oracle_id: slimeOracleId, lang: 'en', layout: 'normal',
};
export const aliasPayload = {
  object: 'list', total_cards: 3, has_more: false,
  data: [
    slimeAliasCard,
    { name: 'Steelbane Hydra', flavor_name: 'Slash Clone', oracle_id: 'e38e3723-05f5-4a51-8364-1cda19f9cc49', lang: 'en', layout: 'normal' },
    { name: 'Vigor', flavor_name: 'Heralds of the Shredder', oracle_id: '70787d8b-0a40-43ea-837a-9617dc13e7e5', lang: 'en', layout: 'normal' },
  ],
};

export const turtleEntry = { id: 'TurtlePower_TMC', name: 'Turtle Power!', code: 'TMC', releaseDate: '2026-03-06' };
export const turtleCatalog = { data: [{ fileName: turtleEntry.id, ...turtleEntry, type: 'Commander Deck' }] };
// Small synthetic 100-card fixture retaining the real alias metadata that triggered the bug.
export const turtlePayload = { data: {
  name: turtleEntry.name, code: turtleEntry.code, type: 'Commander Deck',
  mainBoard: [{ name: 'Forest', count: 97 }, { name: 'Sol Ring', count: 1 },
    { name: 'Acidic Slime', flavorName: 'Marauding Mutagen', count: 1 }],
  commander: [{ name: 'Leonardo, the Balance', count: 1 }],
} };
export const turtleAliasText = '97 Forest\n1 Sol Ring\n1 Marauding Mutagen\n1 Leonardo, the Balance';
