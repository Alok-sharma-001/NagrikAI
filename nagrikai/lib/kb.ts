import social from "@/data/schemes/social_security.json";
import livelihood from "@/data/schemes/livelihood.json";
import education from "@/data/schemes/education.json";
import madhyaPradesh from "@/data/schemes/madhya_pradesh.json";
import documentsJson from "@/data/documents.json";
import type { DocumentInfo, Scheme } from "./types";

// Madhya Pradesh schemes first: they are what an MP citizen asks about most.
export const SCHEMES: Scheme[] = [...madhyaPradesh, ...social, ...livelihood, ...education] as Scheme[];
export const DOCUMENTS: DocumentInfo[] = documentsJson as DocumentInfo[];

const schemeById = new Map(SCHEMES.map((s) => [s.id, s]));
const docById = new Map(DOCUMENTS.map((d) => [d.id, d]));

export const getScheme = (id: string) => schemeById.get(id);
export const getDocument = (id: string) => docById.get(id);
