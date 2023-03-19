import { TypedDispatcher, EventDispatcher, ServiceHelper } from "@weblueth/gattbuilder";

/**
 * @hidden
 */
export enum HeartRateCharacteristic {
    // Heart Rate Measurement,  Client Characteristic Configuration Descriptor
    HeartRateMeasurement = "00002a37-0000-1000-8000-00805f9b34fb", // "heart_rate_measurement",
    // Body Sensor Location
    BodySensorLocation = "00002a38-0000-1000-8000-00805f9b34fb", // "body_sensor_location",
    // Heart Rate Control Point
    HeartRateControlPoint = "00002a39-0000-1000-8000-00805f9b34fb" // "heart_rate_control_point"
}

/**
 * Events raised by the heart rate service
 */
export interface HeartRateEvents {
    /**
     * @hidden
     */
    newListener: keyof HeartRateEvents;
    /**
     * @hidden
     */
    removeListener: keyof HeartRateEvents;
    /**
     * heart rate measurement changed event
     */
    HeartRateMeasurementChanged: HeartRateMeasurement;
}

/**
 * Heart Rate Service
 */
export class HeartRateService extends (EventDispatcher as new () => TypedDispatcher<HeartRateEvents>) {

    /**
     * @hidden
     */
    public static uuid = "0000180d-0000-1000-8000-00805f9b34fb"; // "heart_rate";

    /**
     * @hidden
     */
    public static async create(service: BluetoothRemoteGATTService): Promise<HeartRateService> {
        const bluetoothService = new HeartRateService(service);
        await bluetoothService.init();
        return bluetoothService;
    }

    private helper: ServiceHelper;

    /**
     * @hidden
     */
    constructor(service: BluetoothRemoteGATTService) {
        super();
        this.helper = new ServiceHelper(service, this as any);
    }

    private async init() {
        await this.helper.handleListener(
            "HeartRateMeasurementChanged",
            HeartRateCharacteristic.HeartRateMeasurement,
            this.HeartRateMeasurementHandler.bind(this)
        );
    }

    /**
     * Event handler: heart rate measurement changed
     */
    private HeartRateMeasurementHandler(event: Event) {
        const view = (event.target as BluetoothRemoteGATTCharacteristic).value!;
        this.dispatchEvent("HeartRateMeasurementChanged", parseHeartRate(view));
    }

    /**
     * Read heart rate measurement
     */
    public async readHeartRateMeasurement(): Promise<HeartRateMeasurement> {
        const view = await this.helper.getCharacteristicValue(HeartRateCharacteristic.HeartRateMeasurement);
        return parseHeartRate(view);
    }

    /**
     * Get body sensor location
     */
    public async getBodySensorLocation(): Promise<number> {
        const view = await this.helper.getCharacteristicValue(HeartRateCharacteristic.BodySensorLocation);
        return view.getUint8(0);
    }

    /**
     * Set heart rate control point
     * @param value 0x01 - Reset Energy Expended
     */
    public async setHeartRateControlPoint(value: number): Promise<void> {
        const view = new DataView(new ArrayBuffer(1));
        view.setUint8(0, value);
        return await this.helper.setCharacteristicValue(HeartRateCharacteristic.HeartRateControlPoint, view);
    }

}

/**
 * Web Bluetooth
 * Draft Community Group Report, 9 June 2022
 * Example
 * 
 * https://webbluetoothcg.github.io/web-bluetooth/#introduction-examples
 * 
 */

export type HeartRateMeasurement = {
    heartRate: number;
    contactDetected?: boolean;
    energyExpended?: number;
    rrIntervals?: number[];
};

function parseHeartRate(data: DataView) {
    let flags = data.getUint8(0);
    let rate16Bits = flags & 0x1;
    let result: HeartRateMeasurement = { heartRate: 0 };
    let index = 1;
    if (rate16Bits) {
        result.heartRate = data.getUint16(index, /*littleEndian=*/true);
        index += 2;
    } else {
        result.heartRate = data.getUint8(index);
        index += 1;
    }
    let contactDetected = flags & 0x2;
    let contactSensorPresent = flags & 0x4;
    if (contactSensorPresent) {
        result.contactDetected = !!contactDetected;
    }
    let energyPresent = flags & 0x8;
    if (energyPresent) {
        result.energyExpended = data.getUint16(index, /*littleEndian=*/true);
        index += 2;
    }
    let rrIntervalPresent = flags & 0x10;
    if (rrIntervalPresent) {
        let rrIntervals: number[] = [];
        for (; index + 1 < data.byteLength; index += 2) {
            rrIntervals.push(data.getUint16(index, /*littleEndian=*/true));
        }
        result.rrIntervals = rrIntervals;
    }
    return result;
}
