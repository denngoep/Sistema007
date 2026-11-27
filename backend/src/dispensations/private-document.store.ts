import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { createHash, randomUUID } from 'node:crypto';

import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { resolve } from 'node:path';

@Injectable()
export class PrivateDocumentStore {
  protected root() {
    const root = resolve(
      process.env.DISPENSATION_DOCUMENT_ROOT || './private-documents',
    );

    if (/(^|[\\/])(public|fronted|frontend)([\\/]|$)/i.test(root))
      throw new ServiceUnavailableException(
        'La carpeta documental debe ser privada',
      );

    return root;
  }

  async put(
    bytes: Buffer,
    mime: 'application/pdf' | 'image/png' | 'image/jpeg',
  ) {
    const root = this.root();

    await mkdir(root, { recursive: true, mode: 0o700 });

    const extension =
      mime === 'application/pdf'
        ? '.pdf'
        : mime === 'image/png'
          ? '.png'
          : '.jpg';
    const claveAlmacenamiento = randomUUID() + extension;

    await writeFile(resolve(root, claveAlmacenamiento), bytes, {
      flag: 'wx',
      mode: 0o600,
    });

    return {
      claveAlmacenamiento,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      mime,
      tamano: bytes.length,
    };
  }

  async get(doc: {
    claveAlmacenamiento: string;
    sha256: string;
    tamano: number;
  }) {
    if (!/^[0-9a-f-]{36}\.(pdf|png|jpg)$/.test(doc.claveAlmacenamiento))
      throw new BadRequestException('Referencia documental no v?lida');

    let bytes: Buffer;

    try {
      bytes = await readFile(resolve(this.root(), doc.claveAlmacenamiento));
    } catch {
      throw new ServiceUnavailableException(
        'Documento no disponible; revisar almacenamiento y respaldo',
      );
    }

    if (
      bytes.length !== doc.tamano ||
      createHash('sha256').update(bytes).digest('hex') !== doc.sha256
    )
      throw new ServiceUnavailableException(
        'La integridad del documento no pudo verificarse',
      );

    return bytes;
  }
}
