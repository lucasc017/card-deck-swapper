export const preconEntry = {
  id: 'ForestFriends_TST', name: 'Forest Friends', code: 'TST', releaseDate: '2025-06-01',
};

export const preconCatalogPayload = {
  data: [
    { fileName: preconEntry.id, name: preconEntry.name, code: preconEntry.code, releaseDate: preconEntry.releaseDate, type: 'Commander Deck' },
    { fileName: 'ForestFriendsCollectorSEdition_TST', name: "Forest Friends Collector's Edition", code: 'TST', releaseDate: '2025-06-01', type: 'Commander Deck' },
    { fileName: 'IslandAllies_NEW', name: 'Island Allies', code: 'NEW', releaseDate: '2026-01-01', type: 'Commander Deck' },
    { fileName: 'NotACommanderDeck_TST', name: 'Not a Commander deck', code: 'TST', releaseDate: '2025-06-01', type: 'Starter Kit' },
    { fileName: 'OnlineOnly_TST', name: 'Online only', code: 'TST', releaseDate: '2025-06-01', type: 'MTGO Commander Deck' },
  ],
};

export const preconPayload = {
  data: {
    name: preconEntry.name, code: preconEntry.code, type: 'Commander Deck',
    mainBoard: [
      { name: 'Forest', count: 46, setCode: 'ONE' },
      { name: 'Forest', count: 48, setCode: 'TWO' },
      { name: 'Cultivate', count: 1 },
      { name: 'Sol Ring', count: 1 },
      { name: 'Fire // Ice', count: 1 },
      { name: 'Westvale Abbey // Ormendahl, Profane Prince', count: 1 },
    ],
    commander: [{ name: 'First Commander', count: 1 }, { name: 'Second Commander', count: 1 }],
    sideBoard: [{ name: 'Sideboard card', count: 1 }],
    tokens: [{ name: 'Token', count: 5 }],
    displayCommander: [{ name: 'First Commander', count: 1, isOversized: true }],
    planes: [{ name: 'Plane', count: 10 }],
    schemes: [{ name: 'Scheme', count: 20 }],
  },
};

export const upgradedPreconText = `93 Forest
1 First Commander
1 Second Commander
1 Sol Ring
1 Fire // Ice
1 Westvale Abbey // Ormendahl, Profane Prince
1 Nature's Lore
1 Command Tower`;
