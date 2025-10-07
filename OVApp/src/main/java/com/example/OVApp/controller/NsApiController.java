package com.example.OVApp.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class NsApiController {

    private final WebClient webClient;
    
    @Value("${ns.api.key}")
    private String nsApiKey;


    public NsApiController(WebClient webClient) {
        this.webClient = webClient;
    }

    @GetMapping("/stations")
    public Mono<String> searchStations(@RequestParam String query) {
        System.out.println("Searching stations for query: " + query);
        
        return webClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/reisinformatie-api/api/v2/stations")
                .queryParam("q", query)
                .build())
            .header("Ocp-Apim-Subscription-Key", nsApiKey)
            .retrieve()
            .bodyToMono(String.class)
            .doOnError(error -> System.err.println("Error searching stations: " + error.getMessage()));
    }

    @GetMapping("/trips")
    public Mono<String> getTrips(
            @RequestParam String fromStation,
            @RequestParam String toStation,
            @RequestParam(required = false) String dateTime,
            @RequestParam(required = false, defaultValue = "true") boolean departure) {
        
        System.out.println(String.format("Getting trips from %s to %s", fromStation, toStation));
        
        return webClient.get()
            .uri(uriBuilder -> {
                var builder = uriBuilder
                    .path("/reisinformatie-api/api/v3/trips")
                    .queryParam("fromStation", fromStation)
                    .queryParam("toStation", toStation)
                    .queryParam("searchForArrival", !departure);
                
                if (dateTime != null && !dateTime.isEmpty()) {
                    builder.queryParam("dateTime", dateTime);
                }
                
                return builder.build();
            })
            .header("Ocp-Apim-Subscription-Key", nsApiKey)
            .retrieve()
            .bodyToMono(String.class)
            .doOnError(error -> System.err.println("Error fetching trips: " + error.getMessage()));
    }

    @GetMapping("/disruptions")
    public Mono<String> getDisruptions(
            @RequestParam(required = false) String station) {
        
        System.out.println("Fetching disruptions" + (station != null ? " for station: " + station : ""));
        
        return webClient.get()
            .uri(uriBuilder -> {
                var builder = uriBuilder
                    .path("/reisinformatie-api/api/v3/disruptions");
                
                if (station != null && !station.isEmpty()) {
                    builder.queryParam("station", station);
                }
                
                return builder.build();
            })
            .header("Ocp-Apim-Subscription-Key", nsApiKey)
            .retrieve()
            .bodyToMono(String.class)
            .doOnError(error -> System.err.println("Error fetching disruptions: " + error.getMessage()));
    }
    
    @GetMapping("/price")
    public Mono<String> getPrice(
            @RequestParam String fromStation,
            @RequestParam String toStation,
            @RequestParam(required = false, defaultValue = "2") String travelClass,
            @RequestParam(required = false, defaultValue = "single") String travelType) {
        
        System.out.println(String.format("Getting price from %s to %s", fromStation, toStation));
        
        return webClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/reisinformatie-api/api/v2/price")
                .queryParam("fromStation", fromStation)
                .queryParam("toStation", toStation)
                .queryParam("travelClass", travelClass)
                .queryParam("travelType", travelType)
                .build())
            .header("Ocp-Apim-Subscription-Key", nsApiKey)
            .retrieve()
            .bodyToMono(String.class)
            .doOnError(error -> System.err.println("Error fetching price: " + error.getMessage()));
    }
    

    @GetMapping("/departures")
    public Mono<String> getDepartures(@RequestParam String station) {
        System.out.println("Getting departures for station: " + station);
        
        return webClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/reisinformatie-api/api/v2/departures")
                .queryParam("station", station)
                .build())
            .header("Ocp-Apim-Subscription-Key", nsApiKey)
            .retrieve()
            .bodyToMono(String.class)
            .doOnError(error -> System.err.println("Error fetching departures: " + error.getMessage()));
    }

    @GetMapping("/facilities")
    public Mono<String> getFacilities(@RequestParam String stationCode) {
        System.out.println("Getting facilities for station: " + stationCode);
        
        return webClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/reisinformatie-api/api/v2/stations")
                .queryParam("code", stationCode)
                .build())
            .header("Ocp-Apim-Subscription-Key", nsApiKey)
            .retrieve()
            .bodyToMono(String.class)
            .doOnError(error -> System.err.println("Error fetching facilities: " + error.getMessage()));
    }
}