/**
 * Diverse name pools + hometown/country data for procedural athletes.
 * No real athletes are referenced — names are combined randomly.
 */
export const FIRST_NAMES = [
  // deliberately diverse, many origins
  "Liam","Noah","Mateo","Elijah","Kai","Hiroshi","Amir","Diego","Omar","Lucas",
  "Ethan","Samuel","Jonah","Tariq","Andre","Caleb","Oluwaseun","Ravi","Nikolai","Tomas",
  "Isaac","Mohammed","Daniel","Yusuf","Carlos","Henry","Kofi","Sven","Marco","Jabari",
  "Owen","Hassan","Felix","Dmitri","Tenzin","Arjun","Mateusz","Beniam","Cian","Leandro",
  "Gideon","Sora","Emeka","Levi","Rafael","Abel","Niall","Takoda","Sefu","Joaquin",
  "Micah","Seok","Idris","Bryce","Thabo","Elias","Ronan","Hamza","Keanu","Mattias",
  "Declan","Yohannes","Pablo","Finn","Ousmane","Teodoro","Wyatt","Bodhi","Simeon","Nabil",
];

export const LAST_NAMES = [
  "Okafor","Nakamura","Haddad","Alvarez","Kiptoo","Larsson","Mbeki","Petrov","Costa","Nguyen",
  "Walker","Rahman","Fernandez","Oconnor","Cheruiyot","Bauer","Ferreira","Singh","Kowalski","Yamada",
  "Bekele","Dubois","Romero","Hassan","Andersson","Mwangi","Rossi","Takahashi","Owusu","Castillo",
  "Lindqvist","Abara","Novak","Halliday","Tesfaye","Montgomery","Diallo","Park","Serrano","Kristensen",
  "Benson","Villanueva","Dlamini","Ivanov","Mercer","Gebre","Whitaker","Suzuki","Baptiste","Cho",
  "Hollis","Nkemelu","Sorensen","Reyes","Ngata","Fitzgerald","Adeyemi","Bianchi","Vargas","Olsen",
  "Carrington","Jovanovic","Mahmoud","Delgado","Brennan","Kipngetich","Thorne","Acosta","Weaver","Sato",
];

/** US hometowns — generic cities, no team associations. */
export const US_HOMETOWNS = [
  "Akron, OH","Bend, OR","Chico, CA","Durham, NC","Erie, PA","Fresno, CA","Gastonia, NC",
  "Helena, MT","Ithaca, NY","Joplin, MO","Kearney, NE","Lubbock, TX","Macon, GA","Nampa, ID",
  "Ogden, UT","Peoria, IL","Quincy, MA","Reno, NV","Salem, OR","Topeka, KS","Utica, NY",
  "Vacaville, CA","Waco, TX","Yakima, WA","Boise, ID","Tacoma, WA","Flagstaff, AZ","Billings, MT",
  "Dubuque, IA","Lansing, MI","Tulsa, OK","Spokane, WA","Asheville, NC","Bozeman, MT","Fargo, ND",
];

/** International origins: [country, sample hometown]. Older/more developed. */
export const INTL_ORIGINS: Array<[string, string]> = [
  ["Kenya", "Eldoret"], ["Ethiopia", "Bekoji"], ["Uganda", "Kapchorwa"],
  ["Great Britain", "Leeds"], ["Ireland", "Cork"], ["Canada", "Guelph, ON"],
  ["Australia", "Ballarat"], ["New Zealand", "Dunedin"], ["Spain", "Granada"],
  ["Germany", "Freiburg"], ["Norway", "Bergen"], ["Sweden", "Uppsala"],
  ["Japan", "Sendai"], ["Morocco", "Ifrane"], ["Mexico", "Toluca"],
  ["South Africa", "Potchefstroom"], ["Eritrea", "Asmara"], ["France", "Font-Romeu"],
];
