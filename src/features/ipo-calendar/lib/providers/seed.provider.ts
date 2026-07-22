import { CalendarProvider } from "./types";
import { getCalendarSeed } from "../../data/calendar-seed";

export const seedProvider: CalendarProvider = {
  source: "sample",
  credit: { name: "Sample data" },
  async fetchCatalogue() {
    return getCalendarSeed();
  },
};
