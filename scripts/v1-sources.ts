export interface V1FixtureSource {
  readonly operatore: string;
  readonly commodity: string;
  readonly url: string;
  readonly playwright: boolean;
}

export const V1_FIXTURE_SOURCES: readonly V1FixtureSource[] = [
  { operatore: 'enel', commodity: 'luce', url: 'https://www.enel.it/it-it/luce-gas/offerte-luce', playwright: false },
  { operatore: 'edison', commodity: 'luce', url: 'https://www.edison.it/it-it/luce-gas/offerte-luce', playwright: true },
  { operatore: 'plenitude', commodity: 'luce', url: 'https://eniplenitude.com/offerta/casa/gas-e-luce/offerte-energia-elettrica', playwright: false },
  { operatore: 'hera', commodity: 'luce', url: 'https://heracomm.gruppohera.it/casa/offerte-luce-gas', playwright: false },
  { operatore: 'iren', commodity: 'luce', url: 'https://www.irenlucegas.it/casa', playwright: false },
  { operatore: 'a2a', commodity: 'luce', url: 'https://www.a2a.it/casa/offerte-luce-gas', playwright: false },
  { operatore: 'acea', commodity: 'luce', url: 'https://www.aceaenergia.it/elenco-offerte', playwright: false },
  { operatore: 'sorgenia', commodity: 'luce', url: 'https://www.sorgenia.it/offerte-luce-e-gas-casa', playwright: false },
  { operatore: 'illumia', commodity: 'luce', url: 'https://www.illumia.it/offerte-luce', playwright: false },
  { operatore: 'engie', commodity: 'luce', url: 'https://www.engie.it/casa/offerte-luce-gas/', playwright: false },
  { operatore: 'octopus', commodity: 'luce', url: 'https://octopusenergy.it/offerta/tariffe', playwright: false },
  { operatore: 'nen', commodity: 'luce', url: 'https://nen.it/landing/migliore-offerta-luce', playwright: false },
  { operatore: 'tim', commodity: 'mobile', url: 'https://www.tim.it/fisso-e-mobile/mobile', playwright: false },
  { operatore: 'windtre', commodity: 'mobile', url: 'https://www.windtre.it/offerte-mobile', playwright: true },
  { operatore: 'vodafone', commodity: 'mobile', url: 'https://privati.vodafone.it/mobile/telefonia-mobile', playwright: false },
  { operatore: 'iliad', commodity: 'mobile', url: 'https://www.iliad.it/offerte-iliad-mobile.html', playwright: false },
  { operatore: 'fastweb', commodity: 'mobile', url: 'https://www.fastweb.it/adsl-fibra-ottica/offerta-mobile', playwright: false },
  { operatore: 'skywifi', commodity: 'mobile', url: 'https://www.sky.it/wifi', playwright: false },
  { operatore: 'postemobile', commodity: 'mobile', url: 'https://www.postemobile.it/privati/offerte-telefonia-mobile', playwright: false },
  { operatore: 'ho', commodity: 'mobile', url: 'https://www.ho-mobile.it/tutte-le-offerte', playwright: false },
  { operatore: 'kena', commodity: 'mobile', url: 'https://www.kena.it/offerte-mobile', playwright: false },
  { operatore: 'very', commodity: 'mobile', url: 'https://www.verymobile.it/offerte', playwright: false },
  { operatore: 'tiscali', commodity: 'mobile', url: 'https://www.tiscali.it/mobile', playwright: false },
  { operatore: 'dimensione', commodity: 'mobile', url: 'https://www.dimensione.it/offerte-mobile', playwright: false },
];