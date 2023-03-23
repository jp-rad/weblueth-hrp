import React, { useCallback, useState } from 'react';
import { WbBoundCallback } from '@weblueth/statemachine';
import { DeviceInformation } from '@weblueth/gattbuilder';
import { useWbxActor, WbxCustomEventCallback, WbxDevice, WbxServices } from '@weblueth/react';
import { HeartRate, HeartRateMeasurement, HeartRateService, Services } from '../../../src';

function convLocation(sensorLocation: any) {
    switch (sensorLocation) {
        case 0: return 'Other';
        case 1: return 'Chest';
        case 2: return 'Wrist';
        case 3: return 'Finger';
        case 4: return 'Hand';
        case 5: return 'Ear Lobe';
        case 6: return 'Foot';
        default: return 'Unknown';
    }
}

const defaultName = "(none)";
const defaultLocation = "(unknown)";

export default function HeartRateDevice() {
    /**
     * State machine (xstate)
     */
    const [state, send] = useWbxActor();
    const connectionName = state.context.conn.name;

    // xstate actions
    const reset = () => send("RESET");
    const request = () => send("REQUEST");
    const connect = () => send("CONNECT");
    const disconnect = () => send("DISCONNECT");

    // rejectedReason
    if (state.context.rejectedReason.type !== "NONE") {
        console.log("rejectedReason:", state.context.rejectedReason.message);
    }

    // disconnectedReason
    if (state.context.disconnectedReason.type !== "NONE") {
        console.log("disconnectedReason:", state.context.disconnectedReason.message);
    }

    /**
     * Device
     */
    const [name, setName] = useState<string>(defaultName);
    const onDeviceBound: WbBoundCallback<BluetoothDevice> = bound => {
        if (bound.binding) {
            setName(bound.target.name!);
        } else {
            setName(defaultName);
        }
    }

    /**
     * Services
     */
    const [batteryService, setBatteryService] = useState<BluetoothRemoteGATTService | undefined>(undefined);
    const [battery, setBattery] = useState<number | undefined>(undefined);
    const [deviceInfo, setDeviceInfo] = useState<DeviceInformation | undefined>();

    const onServicesBound: WbBoundCallback<Services> = async bound => {
        // battery_service
        if (bound.binding) {
            console.log(bound.target);
            setBatteryService(bound.target.battery_service);
            const info = await bound.target.deviceInformationService?.readDeviceInformation();
            console.log(info);
            setDeviceInfo(info)
        } else {
            setBatteryService(undefined);
            setBattery(undefined);
            setDeviceInfo(undefined);
        }
    };

    const handlerUpdateBattery = useCallback(async () => {
        if (batteryService) {
            const battery_level = await batteryService.getCharacteristic('battery_level');
            const value = await battery_level.readValue();
            setBattery(value.getUint8(0));
        } else {
            setBattery(undefined);
        }

    }, [batteryService])

    /**
     * Heart Rate Service
     */
    const [heartRate, setHeartRate] = useState<number | undefined>(undefined);
    const [location, setLocation] = useState(defaultLocation);

    const onHeartRateServiceBound: WbBoundCallback<HeartRateService> = async bound => {
        if (bound.binding) {
            // body_sensor_location
            const body_sensor_location = await bound.target.getBodySensorLocation();
            setLocation(convLocation(body_sensor_location));
        } else {
            setHeartRate(undefined);
            setLocation(defaultLocation);
        }
    };
    const onHeartRateMeasurementChanged: WbxCustomEventCallback<HeartRateMeasurement> = async event => {
        setHeartRate(event.detail.heartRate);
    };

    return (
        <>
            <WbxDevice onDeviceBound={onDeviceBound} />
            <WbxServices onServicesBound={onServicesBound} />
            <HeartRate onServiceBound={onHeartRateServiceBound} onHeartRateMeasurementChanged={onHeartRateMeasurementChanged} />
            {connectionName + ": [" + state.toStrings() + "]"}
            <br />
            <button onClick={reset}>RESET</button>
            <button onClick={request}>REQUEST</button>
            <button onClick={connect}>CONNECT</button>
            <button onClick={disconnect}>DISCONNECT</button>
            <br />
            Name: {name} {deviceInfo?.firmwareRevision}
            <br />
            Loaction: {location}
            <br />
            Heart Rate: {heartRate ?? "---"}
            <br />
            <button onClick={handlerUpdateBattery}>Read battery level</button>
            <br />
            Battery: {battery ?? "---"}
        </>
    );
}
