import { useEffect, useState } from "react";

export function useGeoLocation() {
  const [isEuRegion, setIsEuRegion] = useState(false);
  const [country, setCountry] = useState("");

  useEffect(() => {
    // Get values from response headers set by middleware
    const userCountry =
      document.querySelector('meta[name="x-user-country"]')?.getAttribute("content") || "";
    const userEuRegion =
      document.querySelector('meta[name="x-user-eu-region"]')?.getAttribute("content") === "true";

    setCountry(userCountry);
    setIsEuRegion(userEuRegion);
  }, []);

  return { isEuRegion, country };
}
