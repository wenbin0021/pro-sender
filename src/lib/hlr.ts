import { PHONE_RE, normalizePhone } from "./phone";
import type { HlrResult } from "./types";

// Mock HLR (Home Location Register) lookup service.
//
// A real integration would call a provider like Twilio Lookup or an HLR
// gateway. Results here are derived deterministically from the number, so a
// repeated lookup of the same number is always stable — swap `lookupNumber`
// for a real API call when going live.

interface Region {
  prefixes: string[];
  country: string;
  countryCode: string;
  mcc: string;
  networks: Array<{ name: string; mnc: string }>;
}

const REGIONS: Region[] = [
  {
    prefixes: ["65"],
    country: "Singapore",
    countryCode: "SG",
    mcc: "525",
    networks: [
      { name: "Singtel", mnc: "01" },
      { name: "StarHub", mnc: "05" },
      { name: "M1", mnc: "03" },
      { name: "Simba", mnc: "08" },
    ],
  },
  {
    prefixes: ["60"],
    country: "Malaysia",
    countryCode: "MY",
    mcc: "502",
    networks: [
      { name: "Maxis", mnc: "12" },
      { name: "CelcomDigi", mnc: "13" },
      { name: "U Mobile", mnc: "18" },
    ],
  },
  {
    prefixes: ["62"],
    country: "Indonesia",
    countryCode: "ID",
    mcc: "510",
    networks: [
      { name: "Telkomsel", mnc: "10" },
      { name: "Indosat", mnc: "01" },
      { name: "XL Axiata", mnc: "11" },
    ],
  },
  {
    prefixes: ["63"],
    country: "Philippines",
    countryCode: "PH",
    mcc: "515",
    networks: [
      { name: "Globe Telecom", mnc: "02" },
      { name: "Smart Communications", mnc: "03" },
      { name: "DITO", mnc: "88" },
    ],
  },
];

const FALLBACK: Region = {
  prefixes: [],
  country: "Unknown region",
  countryCode: "ZZ",
  mcc: "000",
  networks: [{ name: "International carrier", mnc: "00" }],
};

// Small stable hash so a number always resolves to the same mock result.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function lookupNumber(raw: string): HlrResult {
  const phone = normalizePhone(raw);

  if (!PHONE_RE.test(phone)) {
    return {
      phone: phone || raw.trim(),
      valid: false,
      status: "invalid",
      network: null,
      country: null,
      countryCode: null,
      mccMnc: null,
      ported: false,
    };
  }

  const digits = phone.replace(/^\+/, "");
  const region =
    REGIONS.find((r) => r.prefixes.some((p) => digits.startsWith(p))) ??
    FALLBACK;

  const h = hash(phone);
  const network = region.networks[h % region.networks.length];
  const ported = h % 7 === 0; // ~14% ported to another carrier
  const absent = h % 13 === 0; // ~8% valid format but not reachable

  return {
    phone,
    valid: !absent,
    status: absent ? "absent" : "active",
    network: network.name,
    country: region.country,
    countryCode: region.countryCode,
    mccMnc: `${region.mcc}-${network.mnc}`,
    ported,
  };
}

export function lookupNumbers(raws: string[]): HlrResult[] {
  return raws.map(lookupNumber);
}
