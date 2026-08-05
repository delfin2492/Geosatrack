import { Injectable, Logger } from '@nestjs/common';

export interface TelemetryPayload {
  temperature?: number;
  humidity?: number;
  accel_x?: number;
  accel_y?: number;
  accel_z?: number;
  pitch?: number;
  roll?: number;
  hall_sensor?: number;
  signals?: any;
}

export interface StatusPayload {
  battery_voltage?: number;
  rssi?: number;
  motion?: boolean;
  hop_count?: number;
  update_interval?: number;
  signals?: any;
}

@Injectable()
export class DecoderService {
  private readonly logger = new Logger(DecoderService.name);

  /**
   * Decodes Endpoint 11 (Physical Sensor Telemetry)
   */
  decodeTelemetry(payload: any): TelemetryPayload {
    try {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;

      const evt = parsed.wirepas?.packet_received_event;
      const measurements = evt?.payload_json?.measurements ?? evt?.measurements ?? parsed.payload_json?.measurements ?? parsed.measurements;
      const extractedSignals: any[] = [];
      if (Array.isArray(measurements)) {
        measurements.forEach((m: any) => {
          if (Array.isArray(m.rss_sr_4byte_addr)) {
            m.rss_sr_4byte_addr.forEach((r: any) => {
              if (r.addr && r.addr !== 248) {
                extractedSignals.push({
                  anchorId: String(r.addr),
                  rssi: Number(r.rssi),
                });
              }
            });
          } else if (m.addr && m.rssi !== undefined) {
            extractedSignals.push({
              anchorId: String(m.addr),
              rssi: Number(m.rssi),
            });
          }
        });
      }

      // Extract from raw root keys (e.g. rssi_9023206)
      const targetObj = evt?.payload_json ?? evt ?? parsed;
      for (const key of Object.keys(targetObj)) {
        if (key.startsWith('rssi_') && key !== 'rssi_gateway' && key !== 'gateway_rssi') {
          const addr = key.replace('rssi_', '');
          const rssiVal = Number(targetObj[key]);
          if (!isNaN(rssiVal)) {
            extractedSignals.push({
              anchorId: addr,
              rssi: rssiVal,
            });
          }
        }
      }

      const finalSignals = targetObj.signals ?? targetObj.attributes ?? targetObj.rssi_anchors ?? targetObj.rssiAnchors ?? (extractedSignals.length > 0 ? extractedSignals : null);

      return {
        temperature: parsed.temperature ?? parsed.temp ?? targetObj.temperature ?? targetObj.temp,
        humidity: parsed.humidity ?? parsed.hum ?? targetObj.humidity ?? targetObj.hum,
        accel_x: parsed.accel_x ?? parsed.acc_x ?? targetObj.accel_x ?? targetObj.acc_x ?? 0,
        accel_y: parsed.accel_y ?? parsed.acc_y ?? targetObj.accel_y ?? targetObj.acc_y ?? 0,
        accel_z: parsed.accel_z ?? parsed.acc_z ?? targetObj.accel_z ?? targetObj.acc_z ?? 1.0,
        pitch: parsed.pitch ?? targetObj.pitch ?? 0,
        roll: parsed.roll ?? targetObj.roll ?? 0,
        hall_sensor: parsed.hall_sensor ?? parsed.hall ?? targetObj.hall_sensor ?? targetObj.hall ?? 0,
        signals: finalSignals,
      };
    } catch (error) {
      this.logger.error('Failed to decode Endpoint 11 payload:', error);
      return {};
    }
  }

  /**
   * Decodes Endpoint 238 (Node Health Status)
   */
  decodeStatus(payload: any): StatusPayload {
    try {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;

      const evt = parsed.wirepas?.packet_received_event;
      const measurements = evt?.payload_json?.measurements ?? evt?.measurements ?? parsed.payload_json?.measurements ?? parsed.measurements;
      const extractedSignals: any[] = [];
      if (Array.isArray(measurements)) {
        measurements.forEach((m: any) => {
          if (Array.isArray(m.rss_sr_4byte_addr)) {
            m.rss_sr_4byte_addr.forEach((r: any) => {
              if (r.addr && r.addr !== 248) {
                extractedSignals.push({
                  anchorId: String(r.addr),
                  rssi: Number(r.rssi),
                });
              }
            });
          } else if (m.addr && m.rssi !== undefined) {
            extractedSignals.push({
              anchorId: String(m.addr),
              rssi: Number(m.rssi),
            });
          }
        });
      }

      // Extract from raw root keys (e.g. rssi_9023206)
      const targetObj = evt?.payload_json ?? evt ?? parsed;
      for (const key of Object.keys(targetObj)) {
        if (key.startsWith('rssi_') && key !== 'rssi_gateway' && key !== 'gateway_rssi') {
          const addr = key.replace('rssi_', '');
          const rssiVal = Number(targetObj[key]);
          if (!isNaN(rssiVal)) {
            extractedSignals.push({
              anchorId: addr,
              rssi: rssiVal,
            });
          }
        }
      }

      const finalSignals = targetObj.signals ?? targetObj.attributes ?? targetObj.rssi_anchors ?? targetObj.rssiAnchors ?? (extractedSignals.length > 0 ? extractedSignals : null);

      return {
        battery_voltage: parsed.battery_voltage ?? parsed.battery ?? targetObj.battery_voltage ?? targetObj.battery ?? 3.6,
        rssi: parsed.rssi ?? targetObj.rssi ?? -70,
        motion: parsed.motion ?? targetObj.motion ?? false,
        hop_count: parsed.hop_count ?? targetObj.hop_count ?? 1,
        update_interval: parsed.update_interval ?? targetObj.update_interval ?? 30,
        signals: finalSignals,
      };
    } catch (error) {
      this.logger.error('Failed to decode Endpoint 238 payload:', error);
      return {};
    }
  }

  /**
   * Evaluates the asset status based on sensor values
   */
  evaluateAssetStatus(
    telemetry: TelemetryPayload,
    statusInfo: StatusPayload,
  ): 'static' | 'moving' | 'tilt_warning' | 'fall_detected' | 'high_vibration' {
    const { accel_x = 0, accel_y = 0, accel_z = 1, pitch = 0, roll = 0 } = telemetry;

    // 1. Check for Fall (Impact detection: total acceleration magnitude > 2.5 G)
    const accelMagnitude = Math.sqrt(accel_x ** 2 + accel_y ** 2 + accel_z ** 2);
    if (accelMagnitude > 2.5) {
      return 'fall_detected';
    }

    // 2. Check for Tilt Warning (Sumbu pitch atau roll miring melebihi 15 derajat)
    if (Math.abs(pitch) > 15 || Math.abs(roll) > 15) {
      return 'tilt_warning';
    }

    // 3. Check for high vibration (Vibration on X & Y axes with low Z-variance)
    const horizontalVibration = Math.sqrt(accel_x ** 2 + accel_y ** 2);
    if (horizontalVibration > 0.4 && statusInfo.motion) {
      return 'high_vibration';
    }

    // 4. Check for active motion
    if (statusInfo.motion || Math.abs(accelMagnitude - 1.0) > 0.15) {
      return 'moving';
    }

    // 5. Default state
    return 'static';
  }
}
