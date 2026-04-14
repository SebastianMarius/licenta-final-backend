import { Injectable } from '@nestjs/common';

@Injectable()
export class RentingPageService {
    async getProperty(id: string) {
        const decoded = JSON.parse(Buffer.from(id, 'base64url').toString());
        
        console.log('lets rent this');
        console.log(decoded);
    }
}
