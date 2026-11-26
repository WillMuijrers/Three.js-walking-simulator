// Willekeurige (fictieve) NAW-gegevens: naam, adres, woonplaats
const voornamen = [
  'Daan', 'Sem', 'Lucas', 'Milan', 'Levi', 'Finn', 'Noah', 'Jesse', 'Bram', 'Thijs', 'Ruben', 'Lars',
  'Jan', 'Pieter', 'Kees', 'Henk', 'Willem', 'Mohammed', 'Youssef', 'Stijn', 'Tim', 'Sven',
  'Emma', 'Julia', 'Mila', 'Tess', 'Sophie', 'Zoë', 'Sara', 'Anna', 'Evi', 'Lotte', 'Noor',
  'Fleur', 'Sanne', 'Ingrid', 'Marieke', 'Fatima', 'Yasmin', 'Iris', 'Femke', 'Annelies', 'Lieke',
];
const tussenvoegsels = ['van', 'de', 'van der', 'van den', 'van de', 'ter', 'den'];
const achternamen = [
  'Jansen', 'Bakker', 'Visser', 'Smit', 'Meijer', 'Mulder', 'Bos', 'Vos', 'Peters', 'Hendriks',
  'Dekker', 'Brouwer', 'Kok', 'Jacobs', 'Willems', 'Vermeulen', 'Schouten', 'Hoekstra', 'Koster',
  'Prins', 'Huisman', 'Kuipers', 'Postma', 'Veenstra', 'Kramer', 'Wouters', 'El Amrani', 'Yilmaz',
  'Bergsma', 'Groot', 'Leeuwen', 'Dijk', 'Berg', 'Heuvel', 'Wal', 'Linden', 'Laan', 'Graaf',
];
const straten = [
  'Kerkstraat', 'Dorpsstraat', 'Molenweg', 'Stationsweg', 'Schoolstraat', 'Julianastraat',
  'Wilhelminalaan', 'Beatrixstraat', 'Eikenlaan', 'Lindelaan', 'Kastanjelaan', 'Prinsengracht',
  'Nieuwstraat', 'Marktplein', 'Parkweg', 'Rozenstraat', 'Tulpstraat', 'Vondelstraat',
  'Breestraat', 'Havenkade', 'Zuiderdijk', 'Polderweg', 'Wilgenhof', 'Berkenrode', 'Esdoornlaan',
];
const plaatsen = [
  'Amsterdam', 'Rotterdam', 'Utrecht', 'Den Haag', 'Eindhoven', 'Groningen', 'Tilburg', 'Almere',
  'Breda', 'Nijmegen', 'Haarlem', 'Arnhem', 'Zwolle', 'Leiden', 'Maastricht', 'Dordrecht',
  'Amersfoort', 'Deventer', 'Delft', 'Leeuwarden', 'Alkmaar', 'Hilversum', 'Gouda', 'Assen',
  'Middelburg', 'Venlo', 'Enschede', 'Den Bosch', 'Hoorn', 'Harderwijk',
];
const letters = 'ABCDEFGHJKLMNPRTVWXZ';

export function makeNAW(rand) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const tv = rand() < 0.3 ? pick(tussenvoegsels) + ' ' : '';
  const naam = `${pick(voornamen)} ${tv}${pick(achternamen)}`;
  const huisnummer = 1 + Math.floor(Math.pow(rand(), 2) * 180) + (rand() < 0.1 ? pick(['a', 'b', 'c']) : '');
  const adres = `${pick(straten)} ${huisnummer}`;
  const postcode = `${1000 + Math.floor(rand() * 9000)} ${pick(letters)}${pick(letters)}`;
  return { naam, adres, postcode, woonplaats: pick(plaatsen) };
}
