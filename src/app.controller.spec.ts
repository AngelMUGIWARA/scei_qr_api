import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(() => {
    appController = new AppController(new AppService());
  });

  describe('getHealth', () => {
    it('debe devolver status ok con el nombre del servicio', () => {
      expect(appController.getHealth()).toMatchObject({
        status: 'ok',
        service: 'scei_qr_api',
      });
    });
  });
});
