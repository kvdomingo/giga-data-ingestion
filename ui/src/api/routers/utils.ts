import { AxiosInstance, AxiosResponse } from "axios";

import { Country } from "@/types/country.ts";

export default function routers(axi: AxiosInstance) {
  return {
    isValidDateTimeFormatCodeRequest: ({
      datetime_str,
      format_code,
    }: {
      datetime_str: string;
      format_code: string;
    }): Promise<AxiosResponse<boolean>> => {
      return axi.post("/utils/is_valid_datetime_format_code", {
        datetime_str: datetime_str,
        format_code: format_code,
      });
    },
    format_date: ({
      format_code,
    }: {
      format_code: string;
    }): Promise<AxiosResponse<string>> => {
      return axi.post("/utils/format_date", {
        format_code: format_code,
      });
    },
    listCountries: (): Promise<AxiosResponse<Country[]>> => {
      return axi.get("/utils/countries");
    },
    getDataPrivacyDocument: (): Promise<AxiosResponse<Blob>> => {
      return axi.get("/utils/data-privacy", { responseType: "blob" });
    },
  };
}
