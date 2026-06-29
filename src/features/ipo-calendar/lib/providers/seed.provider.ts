import { CalendarProvider } from "./types";
import { getCalendarSeed } from "../../data/calendar-seed";

export const seedProvider: CalendarProvider = {
  source: "sample",
  async fetchCatalogue() {
    return getCalendarSeed();
  },
};
