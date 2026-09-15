declare namespace PrunApi {
  interface Screen {
    id: string;
    name: string;
    hidden: boolean;
    state: UIState[];
    variables?: ScreenVariable[];
  }

  type ScreenVariableType = 'LOCATION' | 'MATERIAL' | 'COMMODITY_EXCHANGE' | 'STRING';

  interface ScreenVariable {
    id: string;
    type: ScreenVariableType | string;
    name: string;
    options: unknown[];
    value: Address | string | null;
  }
}
