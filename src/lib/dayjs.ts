import configuredDayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

configuredDayjs.extend(utc);
configuredDayjs.extend(timezone);

export const DATE_FORMAT = "YYYY-MM-DD";
export const DATETIME_FORMAT = "YYYY-MM-DD HH:mm";
export const TIME_FORMAT = "HH:mm";
export const WEEKDAY_FORMAT = "ddd";

export const dayjs = configuredDayjs;
