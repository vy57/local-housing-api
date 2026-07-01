require('dotenv').config();

const axios = require('axios');
const express = require('express');

const app = express();
const port = Number.parseInt(process.env.PORT, 10) || 3000;

const mockedData = {
	medianHomePrice: 2200000,
	medianAnnualIncome: 250000,
	millRate: 13.2,
	downPaymentRate: 0.2,
	loanTermYears: 30,
};

async function fetchMortgageRate() {
	const fallbackRate = 0.068;
	const apiKey = process.env.FRED_API_KEY;

	try {
		const response = await axios.get('https://api.stlouisfed.org/fred/series/observations', {
			params: {
				series_id: 'MORTGAGE30US',
				api_key: apiKey,
				file_type: 'json',
				sort_order: 'desc',
				limit: 1,
			},
		});

		const latestObservation = response.data?.observations?.[0]?.value;
		const liveRate = Number.parseFloat(latestObservation);

		if (!Number.isFinite(liveRate)) {
			return fallbackRate;
		}

		return liveRate / 100;
	} catch (error) {
		return fallbackRate;
	}
}

async function fetchMedianIncome(zipCode) {
	const fallbackIncome = 250000;
	const apiKey = process.env.CENSUS_API_KEY;

	try {
		const response = await axios.get(
			`https://api.census.gov/data/2022/acs/acs5?get=NAME,B19013_001E,B25064_001E&for=zip%20code%20tabulation%20area:${zipCode}&key=${apiKey}`
		);

		const incomeValue = response.data?.[1]?.[1];
		const rentValue = response.data?.[1]?.[2];
		const medianIncome = Number.parseFloat(incomeValue);
		const medianGrossRent = Number.parseFloat(rentValue);

		if (!Number.isFinite(medianIncome)) {
			return {
				medianAnnualIncome: fallbackIncome,
				medianGrossRent: Number.isFinite(medianGrossRent) ? medianGrossRent : 0,
			};
		}

		return {
			medianAnnualIncome: medianIncome,
			medianGrossRent: Number.isFinite(medianGrossRent) ? medianGrossRent : 0,
		};
	} catch (error) {
		return {
			medianAnnualIncome: fallbackIncome,
			medianGrossRent: 0,
		};
	}
}

function calculateMonthlyPayment(principal, annualRate, years) {
	const monthlyRate = annualRate / 12;
	const numberOfPayments = years * 12;

	if (monthlyRate === 0) {
		return principal / numberOfPayments;
	}

	return (
		(principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
		(Math.pow(1 + monthlyRate, numberOfPayments) - 1)
	);
}

app.get('/api/affordability', async (req, res) => {
	const { zipCode } = req.query;

	if (!zipCode) {
		return res.status(400).json({ error: 'zipCode query parameter is required' });
	}

	if (!/^[0-9]{5}$/.test(String(zipCode))) {
		return res.status(400).json({ error: 'zipCode must be a 5-digit ZIP code' });
	}

	const mortgageRate = await fetchMortgageRate();
	const { medianAnnualIncome, medianGrossRent } = await fetchMedianIncome(zipCode);
	const downPaymentAmount = mockedData.medianHomePrice * mockedData.downPaymentRate;
	const loanAmount = mockedData.medianHomePrice - downPaymentAmount;
	const monthlyMortgagePayment = calculateMonthlyPayment(
		loanAmount,
		mortgageRate,
		mockedData.loanTermYears
	);
	const annualPropertyTax = (mockedData.medianHomePrice * 0.7) * (mockedData.millRate / 1000);
	const monthlyPropertyTax = annualPropertyTax / 12;
	const annualPMI = mockedData.downPaymentRate < 0.2 ? loanAmount * 0.0075 : 0;
	const monthlyPMI = annualPMI / 12;
	const annualHomeownersInsurance = mockedData.medianHomePrice * 0.005;
	const monthlyHomeownersInsurance = annualHomeownersInsurance / 12;
	const trueMonthlyHousingCost =
		monthlyMortgagePayment + monthlyPropertyTax + monthlyPMI + monthlyHomeownersInsurance;
	const monthlyGrossIncome = medianAnnualIncome / 12;
	const affordabilityScore = trueMonthlyHousingCost / monthlyGrossIncome;
	const rentToIncomeRatio = medianAnnualIncome > 0 ? (medianGrossRent * 12) / medianAnnualIncome : null;

	return res.json({
		zipCode,
		inputs: {
			medianHomePrice: mockedData.medianHomePrice,
			medianAnnualIncome,
			medianGrossRent,
			rentToIncomeRatio,
			millRate: mockedData.millRate,
			downPaymentRate: mockedData.downPaymentRate,
			mortgageRate,
			loanTermYears: mockedData.loanTermYears,
			downPaymentAmount,
			loanAmount,
			monthlyGrossIncome,
			annualPropertyTax,
			monthlyPropertyTax,
			annualPMI,
			monthlyPMI,
			annualHomeownersInsurance,
			monthlyHomeownersInsurance,
		},
		monthlyMortgagePayment: Number(monthlyMortgagePayment.toFixed(2)),
		monthlyPropertyTax: Number(monthlyPropertyTax.toFixed(2)),
		monthlyPMI: Number(monthlyPMI.toFixed(2)),
		monthlyHomeownersInsurance: Number(monthlyHomeownersInsurance.toFixed(2)),
		trueMonthlyHousingCost: Number(trueMonthlyHousingCost.toFixed(2)),
		medianGrossRent: Number(medianGrossRent.toFixed(2)),
		rentToIncomeRatio: rentToIncomeRatio === null ? null : Number(rentToIncomeRatio.toFixed(2)),
		affordabilityScore: Number(affordabilityScore.toFixed(2)),
	});
});

app.listen(port, () => {
	console.log(`Housing affordability API listening on port ${port}`);
});
