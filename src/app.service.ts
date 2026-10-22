import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'scei_qr_api',
      timestamp: new Date().toISOString(),
    };
  }
}
