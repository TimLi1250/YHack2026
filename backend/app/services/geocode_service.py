from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# Lightweight state alias mapping (no external API needed for hackathon)
STATE_ALIASES: dict[str, str] = {
    "al": "Alabama", "ak": "Alaska", "az": "Arizona", "ar": "Arkansas",
    "ca": "California", "co": "Colorado", "ct": "Connecticut", "de": "Delaware",
    "fl": "Florida", "ga": "Georgia", "hi": "Hawaii", "id": "Idaho",
    "il": "Illinois", "in": "Indiana", "ia": "Iowa", "ks": "Kansas",
    "ky": "Kentucky", "la": "Louisiana", "me": "Maine", "md": "Maryland",
    "ma": "Massachusetts", "mi": "Michigan", "mn": "Minnesota", "ms": "Mississippi",
    "mo": "Missouri", "mt": "Montana", "ne": "Nebraska", "nv": "Nevada",
    "nh": "New Hampshire", "nj": "New Jersey", "nm": "New Mexico", "ny": "New York",
    "nc": "North Carolina", "nd": "North Dakota", "oh": "Ohio", "ok": "Oklahoma",
    "or": "Oregon", "pa": "Pennsylvania", "ri": "Rhode Island", "sc": "South Carolina",
    "sd": "South Dakota", "tn": "Tennessee", "tx": "Texas", "ut": "Utah",
    "vt": "Vermont", "va": "Virginia", "wa": "Washington", "wv": "West Virginia",
    "wi": "Wisconsin", "wy": "Wyoming", "dc": "District of Columbia",
}

# Build reverse map too (full name -> full name, for normalization)
_FULL_TO_FULL = {v.lower(): v for v in STATE_ALIASES.values()}

# Reverse: full name -> 2-letter abbreviation
_FULL_TO_ABBREV = {v.lower(): k.upper() for k, v in STATE_ALIASES.items()}


def state_abbrev(state: str) -> str:
    """Return the 2-letter uppercase postal abbreviation for a state name or code."""
    key = re.sub(r"\s+", " ", state.strip().lower())
    if key in STATE_ALIASES:          # already an abbrev key (e.g. 'wi')
        return key.upper()
    if key in _FULL_TO_ABBREV:        # full name (e.g. 'wisconsin')
        return _FULL_TO_ABBREV[key]
    return state.strip()[:2].upper()  # best-effort fallback


def normalize_state(state: str) -> str:
    """Normalize a state abbreviation or name to its full name."""
    key = re.sub(r"\s+", " ", state.strip().lower())
    if key in STATE_ALIASES:
        return STATE_ALIASES[key]
    if key in _FULL_TO_FULL:
        return _FULL_TO_FULL[key]
    return state.strip().title()


def normalize_city(city: str) -> str:
    """Normalize city name whitespace and casing."""
    return re.sub(r"\s+", " ", city.strip()).title()


def get_normalized_location(state: str, city: str) -> dict[str, str]:
    """Return a normalized location dict."""
    return {
        "city": normalize_city(city),
        "state": normalize_state(state),
    }


def get_civic_address(city: str, state: str, street_address: str | None = None) -> str:
    """Return the best street-level address for the Google Civic voterinfo API.

    Priority:
    1. User-provided street_address — always appends city/state so Google
       can resolve it (e.g. '321 Racine Rd' → '321 Racine Rd, Madison, Wisconsin')
    2. Known city hall fallback table
    3. Generic 'City Hall, {city}, {state}' which Google can usually geocode
    """
    norm_city = normalize_city(city)
    norm_state = normalize_state(state)
    abbr = state_abbrev(norm_state)  # e.g. "WI" — Google prefers abbreviations
    if street_address and street_address.strip():
        base = street_address.strip()
        # Append city/state abbreviation if neither is already present
        city_present = norm_city.lower() in base.lower()
        state_present = abbr.lower() in base.lower() or norm_state.lower() in base.lower()
        if not city_present or not state_present:
            return f"{base}, {norm_city}, {abbr}"
        return base
    key = (norm_city.lower(), norm_state.lower())
    known = _CITY_HALL_ADDRESSES.get(key)
    if known:
        return known
    return f"City Hall, {norm_city}, {norm_state}"


# Known city hall street addresses for reliable Google Civic voterinfo lookups.
_CITY_HALL_ADDRESSES: dict[tuple[str, str], str] = {
    ("madison", "wisconsin"): "210 Martin Luther King Jr Blvd, Madison, WI 53703",
    ("milwaukee", "wisconsin"): "200 E Wells St, Milwaukee, WI 53202",
    ("chicago", "illinois"): "121 N LaSalle St, Chicago, IL 60602",
    ("new york", "new york"): "City Hall, New York, NY 10007",
    ("los angeles", "california"): "200 N Spring St, Los Angeles, CA 90012",
    ("houston", "texas"): "901 Bagby St, Houston, TX 77002",
    ("phoenix", "arizona"): "200 W Washington St, Phoenix, AZ 85003",
    ("philadelphia", "pennsylvania"): "1401 JFK Blvd, Philadelphia, PA 19102",
    ("san antonio", "texas"): "100 Military Plaza, San Antonio, TX 78205",
    ("san diego", "california"): "202 C St, San Diego, CA 92101",
    ("dallas", "texas"): "1500 Marilla St, Dallas, TX 75201",
    ("san jose", "california"): "200 E Santa Clara St, San Jose, CA 95113",
    ("austin", "texas"): "301 W 2nd St, Austin, TX 78701",
    ("columbus", "ohio"): "90 W Broad St, Columbus, OH 43215",
    ("san francisco", "california"): "1 Dr Carlton B Goodlett Pl, San Francisco, CA 94102",
    ("seattle", "washington"): "600 4th Ave, Seattle, WA 98104",
    ("denver", "colorado"): "1437 Bannock St, Denver, CO 80202",
    ("boston", "massachusetts"): "1 City Hall Square, Boston, MA 02201",
    ("portland", "oregon"): "1221 SW 4th Ave, Portland, OR 97204",
    ("las vegas", "nevada"): "495 S Main St, Las Vegas, NV 89101",
    ("atlanta", "georgia"): "55 Trinity Ave SW, Atlanta, GA 30303",
    ("minneapolis", "minnesota"): "350 S 5th St, Minneapolis, MN 55415",
    ("miami", "florida"): "3500 Pan American Dr, Miami, FL 33133",
    ("detroit", "michigan"): "2 Woodward Ave, Detroit, MI 48226",
    ("pittsburgh", "pennsylvania"): "414 Grant St, Pittsburgh, PA 15219",
    ("anchorage", "alaska"): "632 W 6th Ave, Anchorage, AK 99501",
    ("honolulu", "hawaii"): "530 S King St, Honolulu, HI 96813",
    ("nashville", "tennessee"): "1 Public Square, Nashville, TN 37201",
    ("memphis", "tennessee"): "125 N Main St, Memphis, TN 38103",
    ("louisville", "kentucky"): "527 W Jefferson St, Louisville, KY 40202",
    ("baltimore", "maryland"): "100 N Holliday St, Baltimore, MD 21202",
    ("albuquerque", "new mexico"): "1 Civic Plaza NW, Albuquerque, NM 87102",
    ("tucson", "arizona"): "255 W Alameda St, Tucson, AZ 85701",
    ("fresno", "california"): "2600 Fresno St, Fresno, CA 93721",
    ("sacramento", "california"): "915 I St, Sacramento, CA 95814",
    ("kansas city", "missouri"): "414 E 12th St, Kansas City, MO 64106",
    ("omaha", "nebraska"): "1819 Farnam St, Omaha, NE 68183",
    ("raleigh", "north carolina"): "222 W Hargett St, Raleigh, NC 27601",
    ("oklahoma city", "oklahoma"): "200 N Walker Ave, Oklahoma City, OK 73102",
    ("washington", "district of columbia"): "1350 Pennsylvania Ave NW, Washington, DC 20004",
    ("charlotte", "north carolina"): "600 E 4th St, Charlotte, NC 28202",
    ("indianapolis", "indiana"): "200 E Washington St, Indianapolis, IN 46204",
    ("tampa", "florida"): "1 Tampa City Center, Tampa, FL 33602",
    ("new orleans", "louisiana"): "1300 Perdido St, New Orleans, LA 70112",
    ("cleveland", "ohio"): "601 Lakeside Ave, Cleveland, OH 44114",
    ("cincinnati", "ohio"): "801 Plum St, Cincinnati, OH 45202",
    ("st. louis", "missouri"): "1200 Market St, St. Louis, MO 63103",
    ("buffalo", "new york"): "65 Niagara Square, Buffalo, NY 14202",
    ("lincoln", "nebraska"): "555 S 10th St, Lincoln, NE 68508",
    ("st. paul", "minnesota"): "15 Kellogg Blvd W, St. Paul, MN 55102",
}
