require('dotenv').config();

const axios = require('axios');

async function fetchRegionalData(zipCodesArray) {
	if (!Array.isArray(zipCodesArray)) {
		throw new TypeError('zipCodesArray must be an array');
	}

	const entries = await Promise.all(
		zipCodesArray.map(async (zipCode) => {
			const normalizedZipCode = String(zipCode).trim();

			try {
				const response = await axios.get(
					`https://api.census.gov/data/2022/acs/acs5?get=NAME,B19013_001E,B25064_001E&for=zip%20code%20tabulation%20area:${normalizedZipCode}&key=${process.env.CENSUS_API_KEY}`
				);

				const incomeValue = response.data?.[1]?.[1];
				const rentValue = response.data?.[1]?.[2];

				return [normalizedZipCode, {
					zipCode: normalizedZipCode,
					medianAnnualIncome: Number.parseFloat(incomeValue),
					medianGrossRent: Number.parseFloat(rentValue),
				}];
			} catch (error) {
				return [normalizedZipCode, {
					zipCode: normalizedZipCode,
					error: error.message,
				}];
			}
		})
	);

	return entries.reduce((accumulator, [zipCode, data]) => {
		accumulator[zipCode] = data;
		return accumulator;
	}, {});
}

module.exports = {
	fetchRegionalData,
};
