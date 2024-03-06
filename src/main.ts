import Color from "@arcgis/core/Color";
import Map from "@arcgis/core/Map";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import type Geometry from "@arcgis/core/geometry/Geometry";
import CSVLayer from "@arcgis/core/layers/CSVLayer";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import LabelClass from "@arcgis/core/layers/support/LabelClass";
import ClassBreaksRenderer from "@arcgis/core/renderers/ClassBreaksRenderer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import OpacityVariable from "@arcgis/core/renderers/visualVariables/OpacityVariable";
import esriRequest from "@arcgis/core/request";
import Query from "@arcgis/core/rest/support/Query";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import WebStyleSymbol from "@arcgis/core/symbols/WebStyleSymbol.js";
import MapView from "@arcgis/core/views/MapView";
import LayerList from "@arcgis/core/widgets/LayerList";
import { defineCustomElements } from "@esri/calcite-components/dist/loader";
import type { GeoJSON } from "geojson";
import "./style.css";
import { cloudSymbol, sunSymbol } from "./symbols";
import type { CityTimes } from "./types";

// Load the Calcite custom elements
defineCustomElements(window, {
  resourcesUrl: "https://js.arcgis.com/calcite-components/2.4.0/assets",
});

// References to the user interface elements
const durationChip = document.querySelector("#duration-chip") as HTMLCalciteChipElement;
const durationListItem = document.querySelector("#duration-list-item") as HTMLCalciteListItemElement;
const endTimeChip = document.querySelector("#end-time-chip") as HTMLCalciteChipElement;
const endTimeListItem = document.querySelector("#end-time-list-item") as HTMLCalciteListItemElement;
const noResultsNotice = document.querySelector("#no-results-notice") as HTMLCalciteNoticeElement;
const obscurationChip = document.querySelector("#obscuration-chip") as HTMLCalciteChipElement;
const obscurationListItem = document.querySelector("#obscuration-list-item") as HTMLCalciteListItemElement;
const queryResultsBlock = document.querySelector("#query-results-block") as HTMLCalciteBlockElement;
const startTimeChip = document.querySelector("#start-time-chip") as HTMLCalciteChipElement;
const startTimeListItem = document.querySelector("#start-time-list-item") as HTMLCalciteListItemElement;

// Set up the user interface
setUp();

// Set the user's timezone in the query results panel
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
queryResultsBlock.description = `${timeZone} timezone`;

// Step 1 - Create a map and view

// When the view is ready
view.when(async () => {
  // Create a GeoJSON layers for the eclipse
  // Step 2 - Create center layer
  // Step 3 - Create additional GeoJSON layers for the duration, penumbra, and totality
  // Step 4 - Watch for when the view is stationary and query information
  // Step 5 - Create the cloud cover layer
  // Step 6 - Create a CSVLayer for festivals
  // Step 7 - Create popups
});

/**
 * Create a GeoJSON layer for the cities and their eclipse times
 *
 * @returns Promise<GeoJSONLayer>
 */
async function createCityTimesLayer(): Promise<GeoJSONLayer> {
  const response = await esriRequest("./data/city-times.json", {
    responseType: "json",
  });

  const geoJSON: GeoJSON = {
    type: "FeatureCollection",
    features: [],
  };

  response.data.forEach((city: CityTimes) => {
    const t0 = parseTimeAndCreateDate(city.ECLIPSE[0]);
    const t1 = parseTimeAndCreateDate(city.ECLIPSE[1]);
    const t2 = parseTimeAndCreateDate(city.ECLIPSE[2]);
    const t3 = parseTimeAndCreateDate(city.ECLIPSE[3]);
    const t4 = parseTimeAndCreateDate(city.ECLIPSE[4]);

    geoJSON.features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [city.LON, city.LAT],
      },
      properties: {
        name: city.NAME,
        state: city.STATE,
        t0,
        t1,
        t2,
        t3,
        t4,
      },
    });
  });

  // create a new blob from the GeoJSON feature collection
  const blob = new Blob([JSON.stringify(geoJSON)], {
    type: "application/json",
  });

  // create a URL for the blob
  const url = URL.createObjectURL(blob);

  // create a new GeoJSONLayer using the blob URL
  const cityTimesGeoJSONLayer = new GeoJSONLayer({
    minScale: 2311162, // zoom 8
    outFields: ["*"],
    renderer: new SimpleRenderer({
      symbol: new SimpleMarkerSymbol({
        color: new Color({
          r: 200,
          g: 200,
          b: 200,
        }),
        outline: {
          color: new Color({
            r: 100,
            g: 100,
            b: 100,
          }),
          width: 1,
        },
        size: 6,
      }),
    }),
    title: "City Eclipse Times",
    url,
  });

  return cityTimesGeoJSONLayer;
}

/**
 * Parse a time string and create a date object
 *
 * @param timeString
 */
function parseTimeAndCreateDate(timeString: string): number {
  const [hour, minute, second] = timeString.split(":").map(Number);
  return new Date(Date.UTC(2024, 3, 8, hour, minute, second)).getTime();
}

/**
 * Query information about the layers at the center of the map view
 *
 * @param cityTimesLayer
 * @param penumbraLayer
 * @param durationlayer
 */
async function queryInformation(
  cityTimesLayer: GeoJSONLayer,
  penumbraLayer: GeoJSONLayer,
  durationlayer: GeoJSONLayer,
) {
  const { zoom } = view;
  if (zoom > 8) {
    noResultsNotice.hidden = true;

    const query = (layer: GeoJSONLayer, geometry: Geometry, outFields: string[]) =>
      layer.queryFeatures(new Query({ geometry, outFields }));

    const averageTime = (times: number[]) =>
      new Date(times.reduce((a, b) => a + b, 0) / times.length).toLocaleTimeString();

    const cityTimesQueryResult = await query(cityTimesLayer, view.extent, ["t0", "t4"]);
    if (cityTimesQueryResult.features.length) {
      const startTimes = cityTimesQueryResult.features.map((feature) => feature.attributes.t0);
      const endTimes = cityTimesQueryResult.features.map((feature) => feature.attributes.t4);
      updateQueryPanel(startTimeListItem, startTimeChip, averageTime(startTimes));
      updateQueryPanel(endTimeListItem, endTimeChip, averageTime(endTimes));
    } else {
      updateQueryPanel(startTimeListItem, startTimeChip, "unknown");
      updateQueryPanel(endTimeListItem, endTimeChip, "unknown");
    }

    const penumbraQueryResult = await query(penumbraLayer, view.center, ["Obscuration"]);
    updateQueryPanel(
      obscurationListItem,
      obscurationChip,
      penumbraQueryResult.features.length
        ? `${Math.round(penumbraQueryResult.features[0].attributes.Obscuration * 100)}%`
        : "unknown",
    );

    const durationQueryResult = await query(durationlayer, view.center, ["Duration"]);
    updateQueryPanel(
      durationListItem,
      durationChip,
      durationQueryResult.features.length
        ? `${Math.round(durationQueryResult.features[0].attributes.Duration)} seconds`
        : "unknown",
    );
  } else {
    noResultsNotice.hidden = false;
    updateQueryPanel(startTimeListItem, startTimeChip, "unknown");
    updateQueryPanel(endTimeListItem, endTimeChip, "unknown");
    updateQueryPanel(obscurationListItem, obscurationChip, "unknown");
    updateQueryPanel(durationListItem, durationChip, "unknown");
  }
}

/**
 * Set up the user interface
 */
function setUp() {
  const toggleModalEl = document.getElementById("toggle-modal") as HTMLCalciteActionElement;
  const navigationEl = document.getElementById("nav") as HTMLCalciteNavigationElement;
  const panelEl = document.getElementById("sheet-panel") as HTMLCalcitePanelElement;
  const modalEl = document.getElementById("modal") as HTMLCalciteModalElement;
  const sheetEl = document.getElementById("sheet") as HTMLCalciteSheetElement;

  toggleModalEl?.addEventListener("click", () => handleModalChange());
  navigationEl?.addEventListener("calciteNavigationActionSelect", () => handleSheetOpen());

  panelEl?.addEventListener("calcitePanelClose", () => handlePanelClose());

  function handleModalChange() {
    if (modalEl) {
      modalEl.open = !modalEl.open;
    }
  }

  function handleSheetOpen() {
    sheetEl.open = true;
    panelEl.closed = false;
  }

  function handlePanelClose() {
    sheetEl.open = false;
  }
}

/**
 * Update list item with the given value
 *
 * @param listItem
 * @param chip
 * @param value
 */
function updateQueryPanel(listItem: HTMLCalciteListItemElement, chip: HTMLCalciteChipElement, value: string) {
  if (value === "unknown") {
    listItem.closed = true;
    chip.hidden = true;
    chip.innerHTML = "";
    chip.value = value;
    return;
  }
  listItem.closed = false;
  chip.hidden = false;
  chip.innerHTML = value;
  chip.value = value;
}
