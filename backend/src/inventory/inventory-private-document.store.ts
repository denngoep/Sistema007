import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { readdir, stat, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

import { PrivateDocumentStore } from '../dispensations/private-document.store';

/**
 * Misma custodia privada e integridad de dispensación, pero con una raíz
 * separada: activar inventario no cambia la ubicación de soportes clínicos.
 */
@Injectable()
export class InventoryPrivateDocumentStore extends PrivateDocumentStore {
  protected root() {
    const root = resolve(
      process.env.INVENTORY_DOCUMENT_ROOT || './private-inventory-documents',
    );
    if (/(^|[\\/])(public|fronted|frontend)([\\/]|$)/i.test(root)) {
      throw new ServiceUnavailableException(
        'La carpeta documental de inventario debe ser privada',
      );
    }
    return root;
  }

  async findUnlinkedCandidates(knownKeys: Set<string>, minAgeMs: number) {
    let entries: string[];
    try {
      entries = await readdir(this.root());
    } catch {
      return [];
    }
    const now = Date.now();
    const candidates: string[] = [];
    for (const name of entries) {
      if (!/^[0-9a-f-]{36}\.(pdf|png|jpg)$/.test(name) || knownKeys.has(name))
        continue;
      const metadata = await stat(resolve(this.root(), name));
      if (metadata.isFile() && now - metadata.mtimeMs >= minAgeMs)
        candidates.push(name);
    }
    return candidates;
  }

  async removeCandidate(key: string) {
    if (!/^[0-9a-f-]{36}\.(pdf|png|jpg)$/.test(key)) {
      throw new ServiceUnavailableException('Referencia documental no válida');
    }
    await unlink(resolve(this.root(), key));
  }
}
