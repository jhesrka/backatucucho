
export class CalificarPedidoDTO {

    private constructor(
        public readonly pedidoId: string,
        public readonly ratingNegocio?: number,
        public readonly ratingMotorizado?: number,
    ) { }

    static create(object: { [key: string]: any }): [string?, CalificarPedidoDTO?] {

        const { pedidoId, ratingNegocio, ratingMotorizado } = object;

        if (!pedidoId) return ['El pedidoId es requerido'];
        
        if (ratingNegocio === undefined && ratingMotorizado === undefined) {
            return ['Se debe proporcionar al menos una calificación (negocio o motorizado)'];
        }

        let rN: number | undefined = undefined;
        let rM: number | undefined = undefined;

        if (ratingNegocio !== undefined) {
            rN = Number(ratingNegocio);
            if (isNaN(rN) || rN < 1 || rN > 5) return ['La calificación del negocio debe estar entre 1 y 5'];
        }

        if (ratingMotorizado !== undefined) {
            rM = Number(ratingMotorizado);
            if (isNaN(rM) || rM < 1 || rM > 5) return ['La calificación del motorizado debe estar entre 1 y 5'];
        }

        return [undefined, new CalificarPedidoDTO(pedidoId, rN, rM)];
    }

}
