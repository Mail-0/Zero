"use client";
import { ParsedMessage } from "@/types";
import Dexie, { Table } from "dexie";

interface MailDatabase extends Dexie {
  threads: Table<ParsedMessage>;
}

const idb = new Dexie("mail0") as MailDatabase;

idb.version(1).stores({
  threads: "++id, title, tags, sender, receivedOn, unread, body, processedHtml, blobUrl, q",
});

export { idb };
