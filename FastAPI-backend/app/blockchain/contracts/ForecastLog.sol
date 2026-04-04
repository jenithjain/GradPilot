// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ForecastLog {
    struct Prediction {
        string domain;
        uint256 forecastValue; // Stored as integer (cents)
        string merkleRoot;     // Data integrity proof
        uint256 timestamp;     // Unix timestamp
        address logger;
    }

    Prediction[] public predictions;

    event NewForecastLogged(uint256 indexed id, string domain, uint256 value);

    function logForecast(
        string memory _domain, 
        uint256 _forecastValue, 
        string memory _merkleRoot, 
        uint256 _timestamp
    ) public {
        predictions.push(Prediction({
            domain: _domain,
            forecastValue: _forecastValue,
            merkleRoot: _merkleRoot,
            timestamp: _timestamp,
            logger: msg.sender
        }));

        emit NewForecastLogged(predictions.length - 1, _domain, _forecastValue);
    }

    function getForecastCount() public view returns (uint256) {
        return predictions.length;
    }

    // Helper to get latest forecast for dashboard
    function getLatestForecast() public view returns (string memory, uint256, string memory, uint256) {
        require(predictions.length > 0, "No forecasts logged");
        Prediction memory p = predictions[predictions.length - 1];
        return (p.domain, p.forecastValue, p.merkleRoot, p.timestamp);
    }
}